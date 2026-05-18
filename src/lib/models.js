export function isImageModel(model) {
  return typeof model === 'string' && model.startsWith('gpt-image-')
}
