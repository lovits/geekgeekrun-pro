import { app, Menu, MenuItemConstructorOptions, MenuItem, BrowserWindow } from 'electron'
import { openDevTools } from '../../commands'

const isMac = process.platform === 'darwin'

const template: (MenuItemConstructorOptions | MenuItem)[] = [
  // { role: 'appMenu' }
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      ] as MenuItemConstructorOptions[]
    : []),
  {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label: '语音',
              submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }]
            }
          ]
        : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]) as MenuItemConstructorOptions[],
      { type: 'separator' }
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: '打开开发者工具',
        accelerator: 'CommandOrControl+Shift+I',
        click(_, win) {
          if (win instanceof BrowserWindow) openDevTools(win)
        }
      }
    ]
  }
]
const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
