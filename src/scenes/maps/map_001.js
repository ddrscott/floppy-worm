import TextBaseScene from '../TextBaseScene';

export default class Map001 extends TextBaseScene {
    constructor() {
        super({
            key: 'Map001',
            title: 'Tutorial - First Steps',
            levelData: `
                ...........
                ..W........
                ...........
                ........*..
                -----------
            `
        });
    }
}
