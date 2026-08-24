import { nativeImage, type NativeImage } from 'electron'

/** 32x32 蓝紫渐变 + 白色 Jeak 单词图标（内嵌 PNG，窗口标题栏/任务栏/系统托盘共用） */
const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABoklEQVR4nMWX11ICQRBF+8dMZc6SQYIISs5I8qPJOV2r0bXGqVmehD4/cPre7tmqJdJwNtdwNdZw1Vdw11bwVFfwVpbwlpfwlZbwF5fwFxYI5Bd4zi0QzM4RzMwRSs8RTs0QSc4QSczw8j5D9G2KaGyK19cpYtEJ4i8T6L5fHK01di2PRyZ4C0/wHhpDVJ4IjpF4VoaQkCcDI4jKU/4RUr4RSFKe9vIAgvKMZwiSlGfdQ5CkPOscgiTlOccAJCnPPw1ALDexD3n+cQBSk2/E/5yc0eUMywsPPIBS+y6SM3by4n0fpO6cMcl1dLmOWvtmABt56a4PUg+OMcn15Iwq31Y7Yycv3fZB6s4ZvXY71NpNWLVbmOTlmx5ITb4ZQNs5s23nm8q1azfVzujyynUPpCZn9IOz27lVu75ztXZ+aoyanLHk1aseyNq5henadUw7V1HfuSk5w/LqZRe0y4+MaedWcpZ/XPAAgvLaeRckKa+ddUGS8vppByQpb5x0QJLy5nEHJClvHrVBkvLWYfv730BUzkjIPw/af/8PReUqe6v9hy/FndkSuXWFsQAAAABJRU5ErkJggg=='

/** 生成应用图标（窗口与托盘共用同一套设计） */
export function createAppIcon(): NativeImage {
  return nativeImage.createFromBuffer(Buffer.from(ICON_BASE64, 'base64'))
}
