import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { piSearchPaths, resolvePiBinary, listPiModels, piCompletion } from './pi-request.mjs'

async function fixture(t, expectedExtension = '') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pi interface '))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const script = path.join(directory, 'cli.mjs')
  await fs.writeFile(script, `
    import fs from 'node:fs';
    const args=process.argv.slice(2);
    if (!['--no-tools','--no-extensions','--no-context-files','--no-session'].every(x=>args.includes(x))) process.exit(9);
    const expectedExtension=${JSON.stringify(expectedExtension)};
    if(expectedExtension && (args[args.indexOf('--extension')+1]!==expectedExtension || !fs.existsSync(expectedExtension))) process.exit(8);
    const model={provider:'test',id:'model',name:'Model',reasoning:true,contextWindow:16000,thinkingLevelMap:{xhigh:null,max:'max'}};
    if(args.includes('rpc')) {
      let data='';process.stdin.on('data',chunk=>{data+=chunk;let i;while((i=data.indexOf('\\n'))>=0){const m=JSON.parse(data.slice(0,i));data=data.slice(i+1);console.log(JSON.stringify({id:m.id,type:'response',success:true,data:m.type==='get_state'?{model,thinkingLevel:'low'}:{models:[model]}}))}});
    } else {
      let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>{
        const input=JSON.parse(data);
        const text=input.at(-1).content;
        if(text==='empty') return;
        if(text==='error') {console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'error',errorMessage:'PRIVATE'}}));return;}
        const images=args.filter(x=>x.startsWith('@'));if(images.some(x=>!fs.existsSync(x.slice(1))))process.exit(7);
        console.log(JSON.stringify({type:'message_end',message:{role:'assistant',provider:'test',model:'model',stopReason:'stop',content:[{type:'text',text:text+' images='+images.length}],usage:{input:10,output:2,cacheRead:3,cacheWrite:0,totalTokens:15}}}));
      });
    }
  `)
  return { piDetectionMode: 'manual', piBinaryPath: script, timeout: 3000 }
}

test('Pi discovery supports Windows npm scripts and skips relative PATH entries', () => {
  const paths = piSearchPaths({ platform: 'win32', home: 'C:\\Users\\Test', env: { APPDATA: 'C:\\Users\\Test\\AppData\\Roaming', Path: 'D:\\My Tools;;relative' } })
  assert.ok(paths.some(p => p.endsWith('node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js')))
  assert.ok(paths.includes('D:\\My Tools\\pi.exe'))
  assert.ok(!paths.some(p => p.startsWith('relative')))
})

test('Pi model interface returns provider-qualified IDs, reasoning support and native context', async t => {
  const settings = await fixture(t)
  const [model] = await listPiModels(settings)
  assert.equal(model.id, 'test/model')
  assert.equal(model.isDefault, true)
  assert.equal(model.contextLimits.maxTokens, 16000)
  assert.ok(model.supportedReasoningEfforts.some(x => x.reasoningEffort === 'max'))
  assert.ok(!model.supportedReasoningEfforts.some(x => x.reasoningEffort === 'xhigh'))
})

test('Pi request uses stdin for Unicode messages and passes image attachments without tools', async t => {
  const settings = await fixture(t)
  const result = await piCompletion([{ role:'user',content:[{type:'text',text:'中文\u2028" $()'}, {type:'image_url',image_url:{url:'data:image/png;base64,aGVsbG8='}}]}], 'test/model', settings)
  assert.equal(result.choices[0].message.content, '中文\u2028" $() images=1')
  assert.equal(result.usage.prompt_tokens, 13)
  assert.equal(result.usage.completion_tokens, 2)
})

test('Pi failures do not expose model diagnostics, and arbitrary context overrides are rejected', async t => {
  const settings = await fixture(t)
  await assert.rejects(piCompletion([{role:'user',content:'error'}], 'test/model', settings), error => !error.message.includes('PRIVATE'))
  await assert.rejects(piCompletion([{role:'user',content:'empty'}], 'test/model', settings), /正文/)
  await assert.rejects(piCompletion([{role:'user',content:'test'}], 'test/model', {...settings,contextWindowTokens:8000}), /原生上下文/)
  await assert.rejects(resolvePiBinary({piDetectionMode:'manual',piBinaryPath:'relative'}), /完整路径/)
})

test('installed Antigravity provider is explicitly loaded for model discovery and requests without enabling other extensions', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pi provider '))
  const previous = process.env.PI_CODING_AGENT_DIR
  t.after(async () => {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previous
    await fs.rm(directory, { recursive: true, force: true })
  })
  process.env.PI_CODING_AGENT_DIR = directory
  const extension = path.join(directory, 'npm', 'node_modules', 'pi-antigravity', 'src', 'index.ts')
  await fs.mkdir(path.dirname(extension), { recursive: true })
  await fs.writeFile(extension, '// fake provider entry')
  const settings = await fixture(t, extension)
  assert.equal((await listPiModels(settings))[0].id, 'test/model')
  assert.equal((await piCompletion([{ role: 'user', content: 'provider test' }], 'test/model', settings)).choices[0].message.content, 'provider test images=0')
})
