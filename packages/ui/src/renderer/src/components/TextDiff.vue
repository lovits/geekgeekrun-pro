<template>
  <pre><template v-for="diff in diffResultList"
    ><del v-if="diff.removed"
      >{{ diff.value }}</del
      ><ins v-else-if="diff.added">{{ diff.value }}</ins
      ><span v-else-if="diff.chunkHeader" class="chunk-header">{{ diff.value }}</span
      ><span v-else>{{ diff.value }}</span
      ></template></pre>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { diffWords } from 'diff'
const props = defineProps({
  a: {
    type: String,
    default: ''
  },
  b: {
    type: String,
    default: ''
  }
})
const diffResultList = computed(() => {
  const diffs = diffWords(props.a, props.b)
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i].added && diffs[i + 1] && diffs[i + 1].removed) {
      ;[diffs[i], diffs[i + 1]] = [diffs[i + 1], diffs[i]]
    }
  }
  return diffs
})
</script>

<style lang="scss" scoped>
pre {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: inherit;
  line-height: 1.6;
}
del {
  text-decoration: line-through;
  color: var(--ggr-diff-del-fg);
  background: var(--ggr-diff-del-bg);
  border-radius: 3px;
  padding: 0 2px;
}

ins {
  background: var(--ggr-diff-ins-bg);
  color: var(--ggr-diff-ins-fg);
  border-radius: 3px;
  padding: 0 2px;
  text-decoration: none;
}

.chunk-header {
  color: var(--ggr-diff-chunk-fg);
  text-decoration: none;
}
</style>
