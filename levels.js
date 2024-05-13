/*
  ###, bottom left to right -> top left to right
  ###, right top to bottom -> right top to bottom
  ###, top left to right -> bottom left to right
  ###, left top to bottom -> left top to bottom
*/

export const levels = {
    "3-1": {
        boardSize: 3,
        disposition: [
            0, 0, 0,
            0, 0, 0,
            0, 1, 3,
            3, 1, 0,
        ]
    },
    "4-1": {
        boardSize: 4,
        disposition: [
            3, 2, 3, 1,
            1, 2, 3, 2,
            2, 3, 1, 3,
            3, 2, 1, 2,
        ]
    },
    "4-2": {
        boardSize: 4,
        disposition: [
            0, 0, 2, 0,
            0, 0, 3, 2,
            0, 0, 0, 4,
            0, 0, 0, 0,
        ]
    },
    "4-3": {
        boardSize: 4,
        disposition: [
            0, 0, 0, 0,
            0, 2, 0, 3,
            0, 0, 0, 3,
            4, 0, 0, 0,
        ]
    },
    "5-1": {
        boardSize: 5,
        disposition: [
            3, 3, 3, 2, 1,
            1, 2, 3, 2, 2,
            3, 2, 1, 2, 2,
            5, 3, 1, 2, 2,
        ]
    },
    "5-2": {
        boardSize: 5,
        disposition: [
            2, 2, 0, 0, 1,
            0, 0, 0, 2, 3,
            2, 0, 3, 0, 3,
            0, 2, 0, 0, 0,
        ]
    },
    "5-3": {
        boardSize: 5,
        disposition: [
            0, 0, 3, 2, 0,
            0, 3, 0, 0, 3,
            0, 0, 3, 0, 4,
            3, 0, 0, 3, 2,
        ]
    },
    "5-4": {
        boardSize: 5,
        disposition: [
            3, 2, 0, 0, 3,
            0, 0, 2, 0, 4,
            0, 0, 4, 0, 0,
            0, 0, 0, 0, 0,
        ]
    },
    "5-5": {
        boardSize: 5,
        disposition: [
            4, 3, 2, 2, 0,
            0, 0, 0, 0, 0,
            0, 2, 1, 3, 3,
            0, 0, 0, 0, 0,
        ]
    },
    "6-1": {
        boardSize: 6,
        disposition: [
            0, 5, 0, 2, 1, 4,
            0, 0, 0, 6, 0, 0,
            0, 0, 0, 0, 0, 2,
            0, 3, 2, 0, 0, 0,
        ]
    },
    "6-2": {
        boardSize: 6,
        disposition: [
            0, 3, 0, 3, 0, 0,
            2, 0, 3, 2, 4, 0,
            0, 0, 4, 2, 0, 4,
            0, 5, 2, 0, 0, 3,
        ]
    },
    "6-3": {
        boardSize: 6,
        disposition: [
            3, 0, 0, 1, 4, 0,
            0, 4, 0, 5, 0, 0,
            2, 0, 0, 0, 2, 2,
            0, 0, 0, 0, 3, 3,
        ]
    },
}
