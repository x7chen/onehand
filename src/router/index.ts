import { createRouter, createWebHashHistory } from 'vue-router'
import UnifiedView from '../views/UnifiedView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'unified',
      component: UnifiedView
    }
  ]
})

export default router