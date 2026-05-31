// Service Worker 内で read-modify-write と送信処理を直列化する mutex。
// 「background が唯一の writer」と併せて、同一予約の二重送信を防ぐ。
let chain: Promise<unknown> = Promise.resolve()

const withLock = <T>(task: () => Promise<T>): Promise<T> => {
  const result = chain.then(task, task)
  // 前段が失敗してもチェーンは止めない
  chain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export { withLock }
