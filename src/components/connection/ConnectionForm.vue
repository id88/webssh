<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="100px"
    class="connection-form"
  >
    <el-form-item label="主机" prop="host">
      <el-input v-model="form.host" placeholder="请输入主机地址" />
    </el-form-item>

    <el-form-item label="端口" prop="port">
      <el-input-number
        v-model="form.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口号"
      />
    </el-form-item>

    <el-form-item label="用户名" prop="username">
      <el-input v-model="form.username" placeholder="请输入用户名" />
    </el-form-item>

    <el-form-item label="密码" prop="password">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="请输入密码"
        show-password
      />
    </el-form-item>

    <el-form-item>
      <el-button type="primary" @click="handleSubmit">连接</el-button>
      <el-button @click="handleReset">重置</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  (e: 'connect', config: {
    host: string
    port: number
    username: string
    password: string
  }): void
}>()

const formRef = ref<FormInstance>()
const form = reactive({
  host: '',
  port: 22,
  username: '',
  password: ''
})

const rules: FormRules = {
  host: [
    { required: true, message: '请输入主机地址', trigger: 'blur' },
  ],
  port: [
    { required: true, message: '请输入端口号', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口号范围为1-65535', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    emit('connect', {
      host: form.host,
      port: form.port,
      username: form.username,
      password: form.password
    })
  } catch (error) {
    ElMessage.error('请填写完整的连接信息')
  }
}

const handleReset = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}
</script>

<style scoped>
.connection-form {
  padding: 20px;
}
</style> 