// TODO: 서버 사이드에서는 getDatabase가 userId를 필요로 하므로, 
// 이 함수는 서버 사이드용으로 재구현이 필요합니다.
// import { getDatabase } from "../database"

export async function openRouterModels(userId?: string) {
    try {
        // TODO: 서버 사이드에서는 userId를 필수로 받아야 합니다.
        // const db = userId ? await getDatabase(userId) : null
        // 임시로 빈 객체 사용 (서버 사이드 재구현 필요)
        const db: any = { openrouterKey: '' }
        let headers = {
            "Authorization": "Bearer " + db.openrouterKey,
            "Content-Type": "application/json"
        }

        const aim = fetch("https://openrouter.ai/api/v1/models", {
            headers: headers
        })  
        const res = await (await aim).json()
        return res.data.map((model: any) => {
            let name = model.name
            let price = ((Number(model.pricing.prompt) * 3) + Number(model.pricing.completion)) / 4
            console.log(model.pricing, price)
            if(price > 0){
                name += ` - $${(price*1000).toFixed(5)}/1k`
            }
            else{
                name += " - Free"
            }
            return {
                id: model.id,
                name: name,
                price: price,
                context_length: model.context_length,
            }
        }).sort((a: any, b: any) => {
            return a.price - b.price
        }).filter((model: any) => {
            return model.price >= 0
        })
    } catch (error) {
        return []
    }
}

export async function getFreeOpenRouterModel(){
    const models = await openRouterModels()
    return models.filter((model: any) => {
        return model.name.endsWith("Free")
    }).sort((a: any, b: any) => {
        return b.context_length - a.context_length
    })[0].id ?? ''
}