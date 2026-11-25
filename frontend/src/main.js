import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import { toastError } from './services/toast'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import './style.css'

document.title = 'Cocolytics'

function applyTabIcons() {
	const links = [
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '192x192',
			href: '/icons/pwa-192x192.png',
		},
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '512x512',
			href: '/icons/pwa-512x512.png',
		},
		{
			rel: 'apple-touch-icon',
			sizes: '180x180',
			href: '/icons/apple-touch-icon.png',
		},
	]

	links.forEach((entry) => {
		const selector = `link[rel="${entry.rel}"]${entry.sizes ? `[sizes="${entry.sizes}"]` : ''}`
		const existing = document.head.querySelector(selector)
		const element = existing || document.createElement('link')

		element.setAttribute('rel', entry.rel)
		if (entry.type) element.setAttribute('type', entry.type)
		if (entry.sizes) element.setAttribute('sizes', entry.sizes)
		element.setAttribute('href', entry.href)

		if (!existing) {
			document.head.appendChild(element)
		}
	})
}

applyTabIcons()
if (!Capacitor.isNativePlatform()) {
	registerSW({ immediate: true })
}

const app = createApp(App)

app.config.errorHandler = (error) => {
	const message = String(error?.message || 'An unexpected error occurred.')
	toastError(message)
}

app.use(IonicVue)
app.use(router)

router.isReady().then(() => app.mount('#app'))
