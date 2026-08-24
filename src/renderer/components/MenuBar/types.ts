/**
 * 菜单项定义（菜单栏通用数据模型）。
 * 各菜单文件通过返回 MenuItem[] 来描述自己的菜单结构，
 * MenuDropdown 负责统一渲染（含子菜单、分隔线、勾选、快捷键等）。
 */
export interface MenuItem {
  /** 唯一标识 */
  id: string
  /** 显示文字 */
  label: string
  /** 快捷键（显示为 <kbd> 标签） */
  shortcut?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 勾选态（如"自动保存"开关） */
  checked?: boolean
  /** 危险操作（红色） */
  danger?: boolean
  /** 该项上方显示分隔线 */
  separator?: boolean
  /** 子菜单 */
  submenu?: MenuItem[]
  /** 点击回调（子菜单项点击后同样触发关闭） */
  onClick?: () => void
}

/** 顶层菜单定义 */
export interface MenuDefinition {
  id: string
  label: string
  items: MenuItem[]
}
