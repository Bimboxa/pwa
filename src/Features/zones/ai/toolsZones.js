import {add} from "dexie";

const toolsZones = [
  {
    type: "function",
    function: {
      name: "manage_zones_tree",
      description:
        "Creates or updates a tree structure representing a building's layout.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["action"],
        properties: {
          action: {
            type: "string",
            description: "The type of action to perform",
            enum: [
              "create_tree",
              "add_node",
              "remove_node",
              "update_node",
              "move_node",
            ],
          },
          targetId: {
            type: "string",
            description:
              "The ID of the node to act on (e.g., apartment ID), if relevant",
          },
          label: {
            type: "string",
            description: "Label of the node to add or update",
          },
          newParentId: {
            type: "string",
            description: "New parent node ID (for move_node)",
          },
          position: {
            type: "integer",
            description:
              "Position index inside the parent’s children (for move_node)",
          },
          children: {
            type: "array",
            description: "Child nodes, used when creating or adding a subtree",
            items: {
              type: "object",
              required: ["id", "label"],
              properties: {
                id: {type: "string"},
                label: {type: "string"},
                children: {
                  type: "array",
                  default: [],
                  items: {
                    type: "object",
                    required: ["id", "label"],
                    properties: {
                      id: {type: "string"},
                      label: {type: "string"},
                      children: {type: "array", items: {}},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
];

export default toolsZones;
