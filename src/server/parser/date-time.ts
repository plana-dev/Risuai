/**
 * 날짜/시간 포맷팅 함수
 */

export function dateTimeFormat(main: string, time = 0): string {
    const date = time === 0 ? (new Date()) : (new Date(time))
    if (!main) {
        return ''
    }
    if (main.startsWith(':')) {
        main = main.substring(1)
    }
    if (main.length > 300) {
        return ''
    }
    return main
        .replace(/YYYY/g, date.getFullYear().toString())
        .replace(/YY/g, date.getFullYear().toString().substring(2))
        .replace(/MMMM/g, Intl.DateTimeFormat('en', { month: 'long' }).format(date))
        .replace(/MMM/g, Intl.DateTimeFormat('en', { month: 'short' }).format(date))
        .replace(/MM/g, (date.getMonth() + 1).toString().padStart(2, '0'))
        .replace(/DDDD/g, Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)).toString())
        .replace(/DD/g, date.getDate().toString().padStart(2, '0'))
        .replace(/dddd/g, Intl.DateTimeFormat('en', { weekday: 'long' }).format(date))
        .replace(/ddd/g, Intl.DateTimeFormat('en', { weekday: 'short' }).format(date))
        .replace(/HH/g, date.getHours().toString().padStart(2, '0'))
        .replace(/hh/g, (date.getHours() % 12 || 12).toString().padStart(2, '0'))
        .replace(/mm/g, date.getMinutes().toString().padStart(2, '0'))
        .replace(/ss/g, date.getSeconds().toString().padStart(2, '0'))
        .replace(/X/g, Math.floor(date.getTime() / 1000).toString())
        .replace(/x/g, date.getTime().toString())
        .replace(/A/g, date.getHours() >= 12 ? 'PM' : 'AM')
}
