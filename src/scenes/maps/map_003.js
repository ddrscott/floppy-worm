import TextBaseScene from '../TextBaseScene';

export default class Map003 extends TextBaseScene {
    constructor() {
        super({
            key: 'Map003',
            title: 'Step Up',
            levelData: `
                ...........
                .........*.
                ..W........
                ......_____
                ...........
                -----------
            `
        });
    }
}
