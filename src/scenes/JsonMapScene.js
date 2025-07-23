import JsonMapBase from './JsonMapBase';

export default class JsonMapScene extends JsonMapBase {
    constructor(config = {}) {
        super(config);
    }
    
    static create(key, mapData) {
        return class extends JsonMapBase {
            constructor() {
                super({
                    key: key,
                    title: mapData.metadata.name,
                    mapData: mapData
                });
            }
        };
    }
}