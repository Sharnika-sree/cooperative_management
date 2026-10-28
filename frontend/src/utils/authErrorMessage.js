export const getAuthErrorMessage = (error, fallback) => {
  const data = error?.response?.data || {}

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const firstMessage = data.errors[0]?.msg || data.errors[0]?.message
    if (typeof firstMessage === 'string' && firstMessage.trim()) {
      return firstMessage
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message
  }

  return fallback
}
