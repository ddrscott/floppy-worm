import JsonMapBase from '../../JsonMapBase';

export default class SwingMap extends JsonMapBase {
    constructor() {
        super(
            {
                key: 'Swinger',
                title: 'Swing away',
                mapData: {
                    "metadata": {
                        "name": "Swinger Away",
                        "difficulty": 1,
                        "description": "Can you swing it?",
                        "modified": "2025-07-20T16:48:53.214Z"
                    },
                    "dimensions": {
                        "width": 768,
                        "height": 1200
                    },
                    "entities": {
                        "wormStart": {
                            "x": 192,
                            "y": 96
                        },
                        "goal": {
                            "x": 148,
                            "y": 480
                        }
                    },
                    "platforms": [
                        {
                            "id": "platform_1753024291308",
                            "type": "rectangle",
                            "x": 192,
                            "y": 416,
                            "width": 385,
                            "height": 38,
                            "color": "#ff6b6b",
                            "physics": {
                                "friction": 0.8,
                                "frictionStatic": 1,
                                "restitution": 0
                            }
                        }
                    ]
                }
            }
        );
    }
}
