import request from '@/utils/request'

const direct = config => request({
  baseURL: '/',
  headers: { isToken: false },
  ...config
})

export function getAlertOverview(params) {
  return direct({
    url: 'alert_statistics-api/api/stats/overview',
    method: 'get',
    params
  }).then(response => response.data)
}
