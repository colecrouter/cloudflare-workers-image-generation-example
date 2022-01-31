# `cloudflare-workers-image-generation-example`

A quick tutorial on how you can create and serve your own images using Cloudflare Workers/Pages Functions.

## Why?

Currently, Workers doesn't implement the canvas API, as there is no `document` object. Because of that, there isn't any obvious way to generate images on-the-fly with Workers.

## How?

Thanks to [upng.js](https://github.com/photopea/UPNG.js/), we can convert raw byte data to and from `.png` files, allowing us to modify raw pixel values. While this means we need to implement any required image processing techniques from scratch, it *is* still possible to do.

## Developing

The code is located entirely inside `functions/index.ts`. This repository follows the Pages Functions (beta) format for brevitey. However, the code also applies traditional Workers.

## Testing

Clone, then install wrangler@beta (or alpha, I'm not your boss).

```
npm install wrangler@beta
```

Serve it locally:

```
npx wrangler pages dev ./public
```

## How Can I Use This?

This example generates an image with 3 random emoji images. It uses image links, but includes functionality for converting from base64. You can implement your own image processing methods, such as scaling, blending, and whatever else you may need, but it's usually quite a math focused process.

## How Well Does it Work?

This example processes three `72x72` images, and takes about 20ms to generate. This doesn't seem leave a lot of headroom, but should be more than enough to generate small images (embeds, favicons, etc). Obviously, as you increase the amount & size of the images being added (as well as any processing techniques), the amount of processing increases, but micro-optimizations (storing repeated images, etc) can help bring that down.
