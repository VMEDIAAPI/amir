
const https = require('https');
const querystring = require('querystring');

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const X_IG_APP_ID = "1217981644879628";

function getId(url) {
    const regex = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)??(p|reels|reel|stories)\/([A-Za-z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[2] : null;
}

function getInstagramGraphqlData(instaUrl, callback) {
    const igId = getId(instaUrl);
    if (!igId) return callback(null);

    const variables = JSON.stringify({ shortcode: igId });
    const postData = querystring.stringify({
        variables: variables,
        doc_id: '10015901848480474',
        lsd: 'AVqbxe3J_YA'
    });

    const options = {
        hostname: 'www.instagram.com',
        path: '/api/graphql',
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-IG-App-ID': X_IG_APP_ID,
            'X-FB-LSD': 'AVqbxe3J_YA',
            'X-ASBD-ID': '129477',
            'Sec-Fetch-Site': 'same-origin',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    callback(json?.data?.xdt_shortcode_media || null);
                } catch {
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    });

    req.on('error', () => callback(null));
    req.write(postData);
    req.end();
}

export default function handler(req, res) {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        res.status(400).json({ code: 400, message: "URL parameter is required" });
        return;
    }

    getInstagramGraphqlData(targetUrl, data => {
        if (data) {
            const output = {
                code: 200,
                caption: data?.edge_media_to_caption?.edges?.[0]?.node?.text || "",
                cover: data?.thumbnail_src || "",
                medias: []
            };

            if (!data.is_video && !data.edge_sidecar_to_children?.edges?.length) {
                output.medias.push({ url: data.display_url, type: "image" });
            } else if (!data.is_video && data.edge_sidecar_to_children?.edges?.length) {
                for (const item of data.edge_sidecar_to_children.edges) {
                    const node = item.node;
                    output.medias.push({
                        url: node.is_video ? node.video_url : node.display_url,
                        type: node.is_video ? "video" : "image"
                    });
                }
            } else {
                output.medias.push({ url: data.video_url, type: "video" });
            }

            res.status(200).json(output);
        } else {
            res.status(404).json({ code: 404, message: "Could not fetch data from Instagram" });
        }
    });
}
