import type { AIChatModel } from '@shared/types'

/** AI 模型选项：value 为 DeepSeek 官方模型 ID，label 为友好显示名（别名） */
export interface ModelOption {
  value: AIChatModel
  /** 模型 ID（发送给 API） */
  id: string
  /** 友好别名 */
  label: string
  /** 简短说明 */
  description: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'deepseek-chat',
    id: 'deepseek-chat',
    label: 'deepseek-flash',
    description: '通用对话，速度快'
  },
  {
    value: 'deepseek-reasoner',
    id: 'deepseek-reasoner',
    label: 'deepseek-pro',
    description: '深度推理，擅长复杂问题'
  }
]

/** 根据模型 ID 获取友好别名 */
export function getModelAlias(id: AIChatModel): string {
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id
}
