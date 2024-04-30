export const cube_vertices = [
    // Front face
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    // Back face
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
    // Top face
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    // Bottom face
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
    // Right face
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
    // Left face
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
];
export const cube_indices = [
    0, 1, 2,
    0, 2, 3,
    4, 5, 6,
    4, 6, 7,
    8, 9, 10,
    8, 10, 11,
    12, 13, 14,
    12, 14, 15,
    16, 17, 18,
    16, 18, 19,
    20, 21, 22,
    20, 22, 23
];
export const cube_normals = [
    // Front
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
];
export const cube_colors = [
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, // green
    1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, // purple
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, // red
    0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, // light blue
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, // blue
    1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, // yellow
];
export const cube_textcoords = [
    // Front
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Back
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Top
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Bottom
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Right
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Left
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
]




export const square_vertices = [
    // Front face
    -1.0, -0.2, 1.0,
    1.0, -0.2, 1.0,
    1.0, 0.0, 1.0,
    -1.0, 0.0, 1.0,
    // Back face
    -1.0, -0.2, -1.0,
    -1.0, 0.0, -1.0,
    1.0, 0.0, -1.0,
    1.0, -0.2, -1.0,
    // Top face
    -1.0, 0.0, -1.0,
    -1.0, 0.0, 1.0,
    1.0, 0.0, 1.0,
    1.0, 0.0, -1.0,
    // Bottom face
    -1.0, -0.2, -1.0,
    1.0, -0.2, -1.0,
    1.0, -0.2, 1.0,
    -1.0, -0.2, 1.0,
    // Right face
    1.0, -0.2, -1.0,
    1.0, 0.0, -1.0,
    1.0, 0.0, 1.0,
    1.0, -0.2, 1.0,
    // Left face
    -1.0, -0.2, -1.0,
    -1.0, -0.2, 1.0,
    -1.0, 0.0, 1.0,
    -1.0, 0.0, -1.0,
];
export const square_indices = [
    0, 1, 2,
    0, 2, 3,
    4, 5, 6,
    4, 6, 7,
    8, 9, 10,
    8, 10, 11,
    12, 13, 14,
    12, 14, 15,
    16, 17, 18,
    16, 18, 19,
    20, 21, 22,
    20, 22, 23
];
export const square_normals = [
    // Front
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
];

export const square_textcoords = [
    // Front
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    // Back
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    // Top
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    // Bottom
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    // Right
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    // Left
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
]