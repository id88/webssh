<script setup lang="ts">
import { ElConfigProvider } from 'element-plus';
</script>

<template>
  <el-config-provider>
    <router-view />
  </el-config-provider>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.el-config-provider {
  height: 100vh;
  width: 100vw;
  display: block;
}
</style>
