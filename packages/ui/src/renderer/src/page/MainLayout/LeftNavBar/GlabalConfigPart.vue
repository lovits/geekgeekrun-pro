<template>
  <div class="group-item">
    <div class="group-title">筛选与配置</div>
    <div flex flex-col class="link-list">
      <RouterLink to="/main-layout/CommonJobConditionConfig"><span>公共筛选规则</span></RouterLink>
      <RouterLink to="/main-layout/AiJobMatch"><span>AI 模型筛选</span></RouterLink>
      <RouterLink to="/main-layout/SettingsPreview"><span>设置总览</span></RouterLink>
      <RouterLink to="/main-layout/BrowserPreferences"><span>浏览器设置</span></RouterLink>
      <RouterLink to="/main-layout/LlmConfig"><span>大模型设置</span></RouterLink>
    </div>
  </div>
</template>
<style scoped lang="scss" src="./style.scss"></style>
