// Failbot needs to load first so we get errors from system lite.
import './github/failbot-error'

// Browser polyfills
import 'smoothscroll-polyfill'

import {apply} from '@github/browser-support'
apply()
