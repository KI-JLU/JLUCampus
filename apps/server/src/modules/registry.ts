import type { SingletonComponentType } from '@justcampus/shared'

import { translatorModule } from './translator/index.js'
import type { ServerModule } from './types.js'

export const moduleRegistry = {
  translator: translatorModule
} satisfies { [T in SingletonComponentType]: ServerModule<T> }
