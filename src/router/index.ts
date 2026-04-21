import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/canvas/:notebookId',
      name: 'canvas',
      component: () => import('../views/CanvasView.vue')
    },
    {
      path: '/pdf/:notebookId',
      name: 'pdf',
      component: () => import('../views/PdfReaderView.vue')
    },
    {
      path: '/multi-chat/:notebookId',
      name: 'multi-chat',
      component: () => import('../views/MultiChatView.vue')
    }
  ]
})

export default router