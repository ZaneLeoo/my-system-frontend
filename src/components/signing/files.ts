import { ElMessage } from 'element-plus'
/** 校验文件响应，并在新窗口保留文件名和扩展名进行预览或下载。 */
export async function openContractBlob(blob: Blob, target: Window | null, fileName?: string | null): Promise<void> {
  if (blob.type.includes('json')) {
    const response = JSON.parse(await blob.text()) as { msg?: string }
    target?.close()
    throw new Error(response.msg ?? '文件读取失败')
  }
  if (!target) {
    ElMessage.warning('请允许浏览器打开新窗口后重试')
    return
  }
  const url = URL.createObjectURL(blob)
  const contentType = blob.type.toLowerCase()
  const extension = contentType.includes('pdf')
    ? '.pdf'
    : contentType.includes('wordprocessingml')
      ? '.docx'
      : contentType.includes('msword')
        ? '.doc'
        : ''
  const suppliedName = typeof fileName === 'string' ? fileName.trim() : ''
  const nameWithFallback = suppliedName || `合同文件${extension}`
  const normalizedName =
    extension && !/\.[^./\\]+$/.test(nameWithFallback) ? `${nameWithFallback}${extension}` : nameWithFallback
  const isPdf = contentType.includes('pdf') || normalizedName.toLowerCase().endsWith('.pdf')
  target.document.title = normalizedName
  target.document.documentElement.style.height = '100%'
  target.document.body.style.margin = '0'
  target.document.body.style.height = '100%'

  if (isPdf) {
    const viewer = target.document.createElement('iframe')
    viewer.title = normalizedName
    viewer.src = url
    viewer.style.width = '100%'
    viewer.style.height = '100vh'
    viewer.style.border = '0'
    target.document.body.replaceChildren(viewer)
  } else {
    const container = target.document.createElement('main')
    container.style.fontFamily = 'Arial, sans-serif'
    container.style.margin = '48px auto'
    container.style.maxWidth = '720px'
    container.style.padding = '0 24px'

    const heading = target.document.createElement('h2')
    heading.textContent = normalizedName

    const message = target.document.createElement('p')
    message.textContent = '此文件格式无法在浏览器中直接预览，请下载后查看。'

    const download = target.document.createElement('a')
    download.href = url
    download.download = normalizedName
    download.textContent = `下载 ${normalizedName}`

    container.append(heading, message, download)
    target.document.body.replaceChildren(container)
    download.click()
  }

  setTimeout(() => URL.revokeObjectURL(url), 120000)
}
/** 官方链接只允许 HTTPS。 */
export function openOfficialUrl(url: string, target: Window | null): void {
  if (!target) {
    ElMessage.warning('请允许打开新窗口')
    return
  }
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'https:' ||
    !(parsed.hostname.endsWith('.esign.cn') || parsed.hostname.endsWith('.tsign.cn'))
  ) {
    target.close()
    throw new Error('平台链接不在允许范围')
  }
  target.opener = null
  target.location.href = url
}
