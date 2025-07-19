import TextBaseScene from '../TextBaseScene';

export default class Map002 extends TextBaseScene {
    constructor() {
        super({
            key: 'Map002',
            title: 'The Gap',
            levelData: `
                ...........
                ..W.....*..
                ...........
                ...........
                -----------
            `
        });
    }
}
