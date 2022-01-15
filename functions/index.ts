import { decode, encode, toRGBA8 } from 'upng-js';

const BG_WIDTH = 216;
const BG_HEIGHT = 72;
const FG_WIDTH = 72;
const FG_HEIGHT = 72;


// You should consider storing decoded images so you can reuse them. That way, you can avoid decoding the same images multiple times.
let imageBuffers: ArrayBuffer[] | undefined;

/*
    If you're generating custom images, you can store them in a map for reuse, as well!. This is especially useful if you're using intensive
    image processing methods, such as colour/transparency blending (https://homepages.inf.ed.ac.uk/rbf/HIPR2/blend.htm <- useful), transformations,
    scaling, etc.

    // let customImageBuffers: Map<string, ArrayBuffer> = new Map();
*/

// Store your urls/base64 images somewhere
let imageURLs = [
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/beaming-face-with-smiling-eyes_1f601.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/cold-face_1f976.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/smiling-face-with-horns_1f608.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/skull_1f480.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/alien_1f47d.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/pouting-face_1f621.png",
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/72/microsoft/310/face-with-spiral-eyes_1f635-200d-1f4ab.png",
];

// @ts-ignore
export const onRequestGet = async ({ request, env, next, data }) => {
    /*
         If you need to make API calls, or fetch a large amount of resources, it's recommended to wrap the following block in a promise. Then, you can
         await the promise, along with ALL of your API calls, etc, and await them all using `await Promise.all([...])`. You can use this to make your
         worker way faster!
    */

    // Try is not required, but it's a good idea to have some form of error handling, so you can serve a fallback image if something goes wrong.
    try {
        // First, we need to make sure our imageBuffers are populated.
        if (imageBuffers === undefined) {
            imageBuffers = [];
            for (let i = 0; i < imageURLs.length; i++) {
                /*
                    You can substitute the line below with a call to base64ToBuffer if you want to use base64 strings. If you're intercepting a call to
                    an image, you can also use `next()` instead of `fetch()`. This is where the magic happens; we use upng-js to decode the png image.
                    Then, we convert it into an RGBA array buffer.
                */
                const imgRaw = await fetch(imageURLs[i]).then(res => res.arrayBuffer());
                const imgBuffer = decode(imgRaw);
                const imgRGBA = toRGBA8(imgBuffer)[0];

                // Add it to our stored images buffer
                imageBuffers.push(imgRGBA);
            }
        }

        // If you're background is an image, you would want to follow the same process as above to decode it. In this case, I'm just using an empty array of RGBA(0,0,0,0).
        const bgLayer = new ArrayBuffer(BG_WIDTH * BG_HEIGHT * 4); // Multiplied by 4, because 4 channels per RGBA pixel

        // Add 3 random items from our imageBuffers to the background layer. We'll start from the left, and add an x offset that increases by 72 each time.
        for (let i = 0; i < 3; i++) {
            const randIndex = Math.floor(Math.random() * imageBuffers.length);
            drawImage(bgLayer, imageBuffers[randIndex], FG_WIDTH * i, 0, BG_WIDTH, BG_HEIGHT, FG_WIDTH, FG_HEIGHT);
        }

        // We insert encode our buffer into a new .png.
        let newImg = encode([bgLayer], BG_WIDTH, BG_HEIGHT, 0);

        // If you explicitly serve this endpoint as a .png (ie: "index.png.ts", instead of "index.ts"), Cloudflare can cache it for you.
        return new Response(newImg, { status: 200, headers: { "content-type": "image/png", "cache-control": "public", "expires": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString() /* One week */ } });
    } catch (e) {
        console.log(e);
        return fetch("<fall-image-url>");
    }
};

const drawImage = (bgLayer: ArrayBuffer, fgLayer: ArrayBuffer, x: number, y: number, bgWidth: number, bgHeight: number, fgWidth: number, fgHeight: number) => {
    /*
        ArrayBuffers are not modifyable by default, so we need to create "views" of the buffers, so that we can modify them. For more info on views & ArrayBuffers, see
        https://javascript.info/arraybuffer-binary-arrays.
    
    */
    const fgView = new Uint8Array(fgLayer);
    const bgView = new Uint8Array(bgLayer);

    /*
        This is where the fun begins. Our ArrayBuffers are a flattened 3D arrays, consisting of X, Y, and RGBA values. Because of this, we need to now the respective
        dimensions of our images, so we can use them *as though* they were 3D arrays. From there, we can iterate through our foreground image, and copy the RGBA values
        onto our background image.
    */

    const cycles = fgWidth * fgHeight * 4; // 4 bytes per pixel
    for (let i = 0; i < cycles; i += 4) {
        const rowOffset = Math.floor((i) / (fgWidth * 4)) /* Current row number */ * ((bgWidth - (fgWidth)) * 4 /* How many pixels until new line*/) + (x * 4) /* X offset */ + (y * (bgWidth * 4)); /* Y offset */

        // Sometimes we have incomplete rows, so we want to ignore bad values instead of throwing an error.
        try {
            if (fgView[((i)) + 3] === 0) { // Transparent
                continue; // Preserve transparency
            } else if (fgView[((i)) + 3] === 255) { // Solid
                // Set all four channels
                bgView[i + 0 + rowOffset] = fgView[i + 0]; // Red
                bgView[i + 1 + rowOffset] = fgView[i + 1]; // Green
                bgView[i + 2 + rowOffset] = fgView[i + 2]; // Blue
                bgView[i + 3 + rowOffset] = fgView[i + 3]; // Alpha
            } else { // Opaque
                // Implement your own custom blending method here.
            }
            // You can also take advantage of bgHeight and implement other types of processing methods.
        } catch (e) { }
    }
};

// You can use this function to generate an image buffer from a base64 string.
const base64ToBuffer = async (base64: string): Promise<ArrayBuffer> => {
    const byteString = atob(base64.split(',')[1]); // Remove "data:image/png;base64,", then decode into binary string.
    const ab = new ArrayBuffer(byteString.length); // Create ArrayBuffer with the length of the decoded base64 string.
    let ia = new Uint8Array(ab); // Create a view of ab.

    // Fill the ArrayBuffer with the decoded base64 string.
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return ab; // Return the updated ArrayBuffer, since the view is linked to it, and it is therefore updated.
};