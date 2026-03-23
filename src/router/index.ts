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
      path: '/canvas/:projectId',
      name: 'canvas',
      component: () => import('../views/CanvasView.vue')
    },
    {
      path: '/node-list/:projectId',
      name: 'node-list',
      component: () => import('../views/NodeListView.vue')
    },
    {
      path: '/pdf/:projectId',
      name: 'pdf',
      component: () => import('../views/PdfReaderView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router
