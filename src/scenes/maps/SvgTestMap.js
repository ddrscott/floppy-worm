import SvgMapScene from '../SvgMapScene';

/**
 * Test scene for SVG map loading
 * Loads the simple tutorial SVG example
 */
export default class SvgTestMap extends SvgMapScene {
    constructor() {
        super({
            key: 'SvgTestMap',
            title: 'SVG Test Map',
            svgPath: '/docs/examples/simple-tutorial.svg',
            returnScene: 'MapSelectScene'
        });
    }
}