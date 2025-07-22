import JsonMapBase from '../../JsonMapBase';

export default class MoreMap extends JsonMapBase {
    constructor() {
        super(
            {
                key: 'MoreMap',
                title: 'More Map Stuff',
                mapData: 
{
  "metadata": {
    "name": "More Map",
    "difficulty": 1,
    "description": "Random Shapes and Platforms",
    "modified": "2025-07-22T02:15:32.901Z"
  },
  "dimensions": {
    "width": 2304,
    "height": 768
  },
  "entities": {
    "wormStart": {
      "x": 192,
      "y": 96
    },
    "goal": {
      "x": 2208,
      "y": 576
    }
  },
  "platforms": [
    {
      "id": "platform_1753149843320",
      "type": "circle",
      "platformType": "bouncy",
      "x": 221,
      "y": 575,
      "radius": 96,
      "color": "#ff9800",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753149868103",
      "type": "rectangle",
      "platformType": "electric",
      "x": 559,
      "y": 694,
      "width": 57,
      "height": 269,
      "color": "#9c27b0",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753149926719",
      "type": "rectangle",
      "platformType": "ice",
      "x": 1166,
      "y": 791,
      "width": 2904,
      "height": 66,
      "color": "#b3e5fc",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753149968511",
      "type": "rectangle",
      "platformType": "electric",
      "x": 816,
      "y": 720,
      "width": 96,
      "height": 96,
      "color": "#9c27b0",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753149973570",
      "type": "rectangle",
      "platformType": "fire",
      "x": 1248,
      "y": 720,
      "width": 192,
      "height": 96,
      "color": "#f44336",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753150159684",
      "type": "rectangle",
      "platformType": "fire",
      "x": 1488,
      "y": 528,
      "width": 96,
      "height": 288,
      "color": "#f44336",
      "physics": {
        "friction": 0.8,
        "frictionStatic": 1,
        "restitution": 0
      }
    },
    {
      "id": "platform_1753150186317",
      "type": "rectangle",
      "platformType": "fire",
      "x": 576,
      "y": 432,
      "width": 192,
      "height": 96,
      "color": "#f44336",
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
