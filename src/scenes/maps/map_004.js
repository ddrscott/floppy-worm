import TextBaseScene from '../TextBaseScene';

export default class Map004 extends TextBaseScene {
    constructor() {
        super({
            key: 'Map004',
            title: 'Zigzag Challenge',
            levelData: `
                .............
                .............
                ..........*..
                ..W..........
                ....-------..
                .............
                -------------
            `
        });
    }
}
