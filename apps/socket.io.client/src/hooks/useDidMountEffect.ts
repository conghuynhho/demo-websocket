import { useEffect, useRef, DependencyList } from 'react'

export default function useDidMountEffect(
  fn: () => void,
  inputs: DependencyList,
): void {
  // prevent 2 calls on initial render
  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
    } else {
      fn()
    }
  }, inputs)
}
