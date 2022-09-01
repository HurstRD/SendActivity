// Safely access Storage items by wrapping a Storage instance
// (localStorage or sessionStorage) with safe versions of its API
// methods.  Callers may opt not to suppress quota errors thrown on
// set in case they rely on recieving them.

// An implementation of the Storage API that throws away all data.  Used in
// cases when the requested Storage backend is not available.

type StorageBackend = 'sessionStorage' | 'localStorage'

class NoOpStorage {
  getItem() {
    return null
  }

  setItem() {
    return undefined
  }

  removeItem() {
    return undefined
  }

  clear() {
    return undefined
  }

  key() {
    return null
  }

  get length() {
    return 0
  }
}

export default function safeStorage<T = string>(
  storageKey: StorageBackend,
  options = {throwQuotaErrorsOnSet: false},
  global = window,
  deserialize: (value: string) => T = value => value as unknown as T,
  serialize: (value: T) => string = (value: T) => value as unknown as string
) {
  let storage: Storage
  try {
    storage = global[storageKey]
  } catch {
    storage = new NoOpStorage()
  }

  const {throwQuotaErrorsOnSet} = options

  // Safely get storage item.
  function getItem(key: string): T | null {
    try {
      const value = storage.getItem(key)
      return value ? deserialize(value) : null
    } catch (error) {
      // Ignore browser private mode error.
      return null
    }
  }

  // Safely set storage item.
  function setItem(key: string, value: T) {
    try {
      storage.setItem(key, serialize(value) as unknown as string)
    } catch (error) {
      if (throwQuotaErrorsOnSet && error.message.toLowerCase().includes('quota')) throw error
    }
  }

  // Safely remove storage item.
  function removeItem(key: string) {
    try {
      storage.removeItem(key)
    } catch (error) {
      // Ignore browser private mode error.
    }
  }
  return {getItem, setItem, removeItem}
}

export function jsonSafeStorage<T>(storageBackend: StorageBackend) {
  return safeStorage<T>(
    storageBackend,
    {throwQuotaErrorsOnSet: false},
    window,
    JSON.parse as (value: string) => T,
    JSON.stringify as (obj: T) => string
  )
}
