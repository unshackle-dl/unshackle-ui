import { type ServiceInfo, type EnhancedSearchResult, type DownloadJob } from './types';

// Mock Services Data
export const mockServices: ServiceInfo[] = [
  {
    id: 'NF',
    name: 'Netflix',
    status: 'available',
    description: 'Netflix streaming service',
    requires_auth: true,
    auth_status: 'authenticated',
  },
  {
    id: 'DSNP',
    name: 'Disney+',
    status: 'available',
    description: 'Disney Plus streaming service',
    requires_auth: true,
    auth_status: 'authenticated',
  },
  {
    id: 'AMZN',
    name: 'Amazon Prime Video',
    status: 'available',
    description: 'Amazon Prime Video streaming service',
    requires_auth: true,
    auth_status: 'unauthenticated',
  },
  {
    id: 'ATVP',
    name: 'Apple TV+',
    status: 'unavailable',
    description: 'Apple TV Plus streaming service',
    requires_auth: true,
    auth_status: 'unauthenticated',
  },
  {
    id: 'MAX',
    name: 'Max (HBO)',
    status: 'available',
    description: 'Max (formerly HBO Max) streaming service',
    requires_auth: true,
    auth_status: 'expired',
  },
];

// Mock Search Results
export const mockSearchResults: EnhancedSearchResult[] = [
  {
    unshackleResult: {
      id: 'nf_stranger_things',
      title: 'Stranger Things',
      type: 'tv',
      year: 2016,
      description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments.',
      service: 'NF',
    },
    tmdbData: {
      id: 66732,
      media_type: 'tv',
      name: 'Stranger Things',
      overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
      poster_path: '/49WJfeN0moxb9IPfFn8cnKGHTsB.jpg',
      backdrop_path: '/muth4OYamXf41G2evdrLEg8d3om.jpg',
      first_air_date: '2016-07-15',
      vote_average: 8.6,
      vote_count: 18482,
      genre_ids: [18, 10765, 9648],
      adult: false,
      original_language: 'en',
      popularity: 369.337,
    },
    displayTitle: 'Stranger Things',
    displayYear: '2016',
    posterURL: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfFn8cnKGHTsB.jpg',
    backdropURL: 'https://image.tmdb.org/t/p/w1280/muth4OYamXf41G2evdrLEg8d3om.jpg',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
    rating: 8.6,
    genres: ['Drama', 'Sci-Fi & Fantasy', 'Mystery'],
  },
  {
    unshackleResult: {
      id: 'dsnp_mandalorian',
      title: 'The Mandalorian',
      type: 'tv',
      year: 2019,
      description: 'A lone gunfighter makes his way through the outer reaches of the galaxy.',
      service: 'DSNP',
    },
    tmdbData: {
      id: 82856,
      media_type: 'tv',
      name: 'The Mandalorian',
      overview: 'After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, far from the authority of the New Republic.',
      poster_path: '/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg',
      backdrop_path: '/9ijMGlJKqcslswWUzTEwScm82Gs.jpg',
      first_air_date: '2019-11-12',
      vote_average: 8.4,
      vote_count: 8679,
      genre_ids: [10765, 37, 18, 10759],
      adult: false,
      original_language: 'en',
      popularity: 218.205,
    },
    displayTitle: 'The Mandalorian',
    displayYear: '2019',
    posterURL: 'https://image.tmdb.org/t/p/w500/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg',
    backdropURL: 'https://image.tmdb.org/t/p/w1280/9ijMGlJKqcslswWUzTEwScm82Gs.jpg',
    description: 'After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, far from the authority of the New Republic.',
    rating: 8.4,
    genres: ['Sci-Fi & Fantasy', 'Western', 'Drama', 'Action & Adventure'],
  },
  {
    unshackleResult: {
      id: 'nf_ozark',
      title: 'Ozark',
      type: 'tv',
      year: 2017,
      description: 'A financial advisor drags his family from Chicago to the Missouri Ozarks.',
      service: 'NF',
    },
    tmdbData: {
      id: 69740,
      media_type: 'tv',
      name: 'Ozark',
      overview: 'A financial adviser drags his family from Chicago to the Missouri Ozarks, where he must launder $500 million in five years to appease a drug boss.',
      poster_path: '/xABQJqNnZRCPgFIW7Qt7CK3tD5b.jpg',
      backdrop_path: '/muth4OYamXf41G2evdrLEg8d3om.jpg',
      first_air_date: '2017-07-21',
      vote_average: 8.2,
      vote_count: 3456,
      genre_ids: [80, 18],
      adult: false,
      original_language: 'en',
      popularity: 127.891,
    },
    displayTitle: 'Ozark',
    displayYear: '2017',
    posterURL: 'https://image.tmdb.org/t/p/w500/xABQJqNnZRCPgFIW7Qt7CK3tD5b.jpg',
    backdropURL: 'https://image.tmdb.org/t/p/w1280/muth4OYamXf41G2evdrLEg8d3om.jpg',
    description: 'A financial adviser drags his family from Chicago to the Missouri Ozarks, where he must launder $500 million in five years to appease a drug boss.',
    rating: 8.2,
    genres: ['Crime', 'Drama'],
  },
];

// Mock Download Jobs
export const mockDownloadJobs: DownloadJob[] = [
  {
    id: 'job_001',
    service: 'NF',
    content_id: 'nf_stranger_things_s4e1',
    content_title: 'Stranger Things S4E1: The Hellfire Club',
    status: 'downloading',
    progress: 67,
    current_file: 'stranger_things_s4e1_1080p.mkv',
    total_files: 1,
    downloaded_bytes: 1073741824, // 1GB
    total_bytes: 1610612736, // 1.5GB
    start_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Started 10 minutes ago
  },
  {
    id: 'job_002',
    service: 'DSNP',
    content_id: 'dsnp_mandalorian_s3e1',
    content_title: 'The Mandalorian S3E1: The Apostate',
    status: 'queued',
    start_time: new Date().toISOString(),
  },
  {
    id: 'job_003',
    service: 'NF',
    content_id: 'nf_ozark_s4e7',
    content_title: 'Ozark S4E7: Sanctified',
    status: 'completed',
    progress: 100,
    total_files: 1,
    downloaded_bytes: 2147483648, // 2GB
    total_bytes: 2147483648,
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Started 2 hours ago
    end_time: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // Finished 90 minutes ago
  },
  {
    id: 'job_004',
    service: 'AMZN',
    content_id: 'amzn_jack_ryan_s1e1',
    content_title: 'Jack Ryan S1E1: Pilot',
    status: 'failed',
    error: 'Authentication required: Please log in to Amazon Prime Video',
    start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Started 30 minutes ago
  },
];

// Initialize mock data
export function initializeMockData() {
  // This would typically be called on app startup
  console.log('Mock data initialized');
}