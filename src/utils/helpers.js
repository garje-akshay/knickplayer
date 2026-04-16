export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

export function detectMediaType(filename, mimeType) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const audioExts = [
    'mp3','wav','flac','ogg','oga','aac','wma','m4a','m4b','opus','ac3','dts',
    'aiff','aif','ape','mka','wv','tta','tak','shn','ra','ram','mid','midi',
    'mod','s3m','xm','it','amr','awb','caf','au','snd','spx','dsf','dff',
    'alac','mp2','mp1','mpc','aa','aax','pcm','gsm','adts','w64','rf64',
  ];
  if (audioExts.includes(ext) || (mimeType && mimeType.startsWith('audio/'))) return 'audio';
  return 'video';
}

export function getFilenameFromUrl(url) {
  try { return new URL(url).pathname.split('/').pop() || url; } catch { return url; }
}

export const MEDIA_EXTENSIONS = [
  // Video
  'mp4','m4v','webm','mkv','avi','mov','flv','wmv','ogv','ogm','ogx',
  'mpg','mpeg','mpe','mpv','mp2v','m2v','m1v','3gp','3g2',
  'ts','mts','m2ts','m2t','vob','divx','xvid','asf','rm','rmvb',
  'f4v','f4p','f4a','f4b','dv','gxf','mxf','roq','nuv','nsv',
  'flc','fli','rec','wtv','dvr-ms','bik','smk','vp6',
  'h264','h265','hevc','av1','vp8','vp9','y4m','yuv','ivf',
  'swf','nut','mj2','dpx','cin','cdg','ifo','matroska',
  // Audio
  'mp3','wav','flac','ogg','oga','aac','wma','m4a','m4b','opus','ac3','dts',
  'aiff','aif','ape','mka','wv','tta','tak','shn','ra','ram','mid','midi',
  'mod','s3m','xm','it','amr','awb','caf','au','snd','spx','dsf','dff',
  'alac','mp2','mp1','mpc','aa','aax','pcm','gsm','adts','w64','rf64',
  // Playlist
  'm3u','m3u8','pls','xspf','wpl','cue','asx','b4s',
];

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
export const EQ_PRESETS = {
  flat:[0,0,0,0,0,0,0,0,0,0], classical:[0,0,0,0,0,0,-4,-4,-4,-6],
  club:[0,0,4,3,3,3,2,0,0,0], dance:[6,4,1,0,0,-3,-4,-4,0,0],
  fullbass:[6,6,6,4,1,-2,-5,-6,-7,-7], fullbasstreble:[4,3,0,-4,-3,1,5,7,8,8],
  fulltreble:[-6,-6,-6,-2,1,7,10,10,10,10], headphones:[3,7,3,-2,-1,1,3,6,8,9],
  largehall:[7,7,3,3,0,-3,-3,-3,0,0], live:[-3,0,2,3,3,3,2,1,1,1],
  party:[4,4,0,0,0,0,0,0,4,4], pop:[-1,3,4,5,3,0,-1,-1,-1,-1],
  reggae:[0,0,0,-3,0,4,4,0,0,0], rock:[5,3,-3,-5,-2,2,5,7,7,7],
  ska:[-1,-3,-2,0,2,3,5,6,7,6], soft:[3,1,0,-1,0,2,5,6,7,8],
  softrock:[2,2,1,0,-2,-3,-2,0,1,5], techno:[5,3,0,-3,-3,0,5,6,6,5]
};
