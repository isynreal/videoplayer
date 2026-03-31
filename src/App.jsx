import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, deleteDoc, doc, getDoc, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Play, Pause, Volume2, X, List, Share2, Film, Image as ImageIcon,
  ExternalLink, Check, Youtube, Trash2, Pencil, Search, Plus,
  Facebook, Video, Filter, Instagram, Twitter, AtSign, Calendar,
  ArrowUpDown
} from 'lucide-react';
import { motion } from 'framer-motion';

const APP_VERSION = "2.0.0"; // 🌟 大版本更新：iOS 頂級玻璃質感 UI 與物理彈跳特效

// --- 設定區域 ---
const firebaseConfig = {
  apiKey: "AIzaSyAYhJ0BeSwR0i-x9HHAVXR2p_1dD0l-an4",
  authDomain: "video-faa49.firebaseapp.com",
  projectId: "video-faa49",
  storageBucket: "video-faa49.firebasestorage.app",
  messagingSenderId: "648988955584",
  appId: "1:648988955584:web:47ffd523c7f73a51f02e25",
  measurementId: "G-LTCZEXHP3B"
};

const configToUse = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : firebaseConfig;

const app = initializeApp(configToUse);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'video-app';

// --- Helper Functions ---
const getEmbedInfo = (url) => {
  if (!url) return null;
  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const ytMatch = url.match(ytRegExp);
  if (ytMatch && ytMatch[2].length === 11) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[2]}?autoplay=1`, id: ytMatch[2] };

  const vimeoRegExp = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch && vimeoMatch[1]) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };

  if (url.includes('facebook.com') || url.includes('fb.watch')) {
    const encodedUrl = encodeURIComponent(url);
    return { type: 'facebook', src: `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&t=0&autoplay=1` };
  }

  if (url.includes('tiktok.com')) {
    const videoIdMatch = url.match(/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    return { type: 'tiktok', src: videoId ? `https://www.tiktok.com/embed/v2/${videoId}?lang=zh-Hant-TW` : url, isShortLink: !videoId };
  }

  if (url.includes('douyin.com')) return { type: 'douyin', src: url };

  if (url.includes('instagram.com')) {
    const match = url.match(/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return { type: 'instagram', src: `https://www.instagram.com/p/${match[1]}/embed/captioned/` };
  }

  if (url.includes('threads.net') || url.includes('threads.com')) {
    const match = url.match(/\/post\/([^/?&]+)/);
    if (match && match[1]) return { type: 'threads', src: url };
  }

  if (url.includes('twitter.com') || url.includes('x.com')) {
    const match = url.match(/\/status\/(\d+)/);
    if (match && match[1]) return { type: 'twitter', src: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}` };
  }

  return { type: 'native', src: url };
};

const getYouTubeThumbnail = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

const formatDate = (dateString) => {
  if (!dateString) return '無日期';
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 🍏 蘋果風：Q彈毛玻璃按鈕 (Squishy Glass Button)
const GlassButton = ({ children, onClick, className = "", disabled = false, type = "button" }) => {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.92, transition: { type: "spring", stiffness: 400, damping: 10 } }}
      className={`
        relative overflow-hidden
        bg-white/10 backdrop-blur-md border border-white/20 shadow-lg
        text-white font-medium
        before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

// 🍏 蘋果風：毛玻璃卡片 (用於影片庫或播放清單)
const GlassCard = ({ children, onClick, className = "" }) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -5, scale: 1.01 }}
      whileTap={{ scale: 0.98 }} // 點擊時微微內縮
      className={`
        bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl
        rounded-2xl overflow-hidden cursor-pointer
        hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]
        transition-colors duration-300
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};


// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc'); 
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [sharedPlaylistId, setSharedPlaylistId] = useState(null);
  const [sharedPlaylistData, setSharedPlaylistData] = useState(null);

  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (e) { console.error("登入失敗:", e); } };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#playlist/')) {
        setSharedPlaylistId(hash.split('/')[1]);
        setActiveTab('shared');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => { unsubscribe(); window.removeEventListener('hashchange', checkHash); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubVideos = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'videos')), 
      (snapshot) => setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    const unsubPlaylists = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), orderBy('createdAt', 'desc')), 
      (snapshot) => setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    return () => { unsubVideos(); unsubPlaylists(); };
  }, [user]);

  useEffect(() => {
    if (sharedPlaylistId && user) {
      getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', sharedPlaylistId))
        .then(docSnap => {
          if (docSnap.exists()) setSharedPlaylistData({ id: docSnap.id, ...docSnap.data() });
          else { alert('找不到該播放清單'); setSharedPlaylistId(null); setActiveTab('home'); }
        }).catch(console.error);
    }
  }, [sharedPlaylistId, user]);

  const allTags = useMemo(() => {
    const tagMap = new Map();
    videos.forEach(v => {
      v.tags?.forEach(t => {
        if (!tagMap.has(t)) {
          tagMap.set(t, { name: t, latest: v.createdAt || '', oldest: v.createdAt || '' });
        } else {
          const data = tagMap.get(t);
          if ((v.createdAt || '') > data.latest) data.latest = v.createdAt;
          if ((v.createdAt || '') < data.oldest) data.oldest = v.createdAt;
        }
      });
    });
    const tagArray = Array.from(tagMap.values());
    tagArray.sort((a, b) => {
      if (sortBy === 'date_desc') return b.latest.localeCompare(a.latest);
      if (sortBy === 'date_asc') return a.oldest.localeCompare(b.oldest);
      if (sortBy === 'title_asc') return a.name.localeCompare(b.name, 'zh-TW');
      if (sortBy === 'title_desc') return b.name.localeCompare(a.name, 'zh-TW');
      return 0;
    });
    return tagArray.map(t => t.name);
  }, [videos, sortBy]);

  const filteredVideos = useMemo(() => {
    let source = [...videos]; 
    if (activeTab === 'shared' && sharedPlaylistData) source = source.filter(v => sharedPlaylistData.videoIds.includes(v.id));
    else if (activeTab === 'shared' && !sharedPlaylistData) return [];
    
    let result = source.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag ? v.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    });

    result.sort((a, b) => {
      if (sortBy === 'date_desc') return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (sortBy === 'date_asc') return (a.createdAt || '').localeCompare(b.createdAt || '');
      if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'zh-TW');
      if (sortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '', 'zh-TW');
      return 0;
    });
    return result;
  }, [videos, searchQuery, selectedTag, activeTab, sharedPlaylistData, sortBy]);
  
  const handleDeleteGlobalTag = async (tagToDelete) => {
    if (!confirm(`確定要從系統中徹底刪除「#${tagToDelete}」標籤嗎？\n\n(此動作會將該標籤從所有關聯的影片中移除)`)) return;
    const videosToUpdate = videos.filter(v => v.tags?.includes(tagToDelete));
    try {
      const updatePromises = videosToUpdate.map(v => {
        const newTags = v.tags.filter(t => t !== tagToDelete);
        return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', v.id), { tags: newTags });
      });
      await Promise.all(updatePromises);
      if (selectedTag === tagToDelete) setSelectedTag(null);
    } catch (error) {
      alert("刪除標籤失敗：" + error.message);
    }
  };

  if (!user) return <div className="min-h-screen bg-[#0f111a] flex items-center justify-center text-white p-4">正在連線至資料庫...</div>;

  const isSharedMode = activeTab === 'shared';
  const isAdmin = !isSharedMode;

  return (
    // 🌟 修改：深色質感背景 + 動態模糊環境光暈
    <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans pb-10 relative overflow-hidden">
      
      {/* 🔮 魔法環境光暈 (Ambient Light Orbs) */}
      <div className="absolute top-[-10%] left-[0%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[160px] pointer-events-none"></div>

      {/* 🌟 修改：毛玻璃半透明導覽列 */}
      <nav className="bg-black/30 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-30 shadow-2xl relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center cursor-pointer flex-shrink-0 mr-4" onClick={() => {
                if (!isSharedMode) { setActiveTab('home'); setSharedPlaylistId(null); setSearchQuery(''); setSelectedTag(null); window.location.hash = ''; }
              }}>
              <img src="/logo.png" alt="iSynReal Logo" className="h-9 md:h-10 object-contain bg-white/95 px-2 py-1.5 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
              {isSharedMode && (
                  <span className="font-bold text-lg md:text-xl tracking-tight text-white/90 border-l-2 border-white/20 pl-4 ml-4">
                      {sharedPlaylistData?.title || '播放清單'}
                  </span>
              )}
            </div>

            {!isSharedMode && (
              <div className="flex-1 max-w-md mx-4 hidden md:block">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" /></div>
                  <input type="text" className="block w-full pl-11 pr-4 py-2.5 border border-white/10 rounded-full bg-white/5 backdrop-blur-md text-white placeholder-gray-400 focus:outline-none focus:bg-white/10 focus:border-blue-500/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all sm:text-sm" placeholder="搜尋影片庫..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            )}

            {!isSharedMode && (
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 md:overflow-visible">
                <button onClick={() => setActiveTab('home')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'home' ? 'bg-white text-black shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>影片庫</button>
                <button onClick={() => setActiveTab('playlists')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'playlists' ? 'bg-white text-black shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>播放清單</button>
                <GlassButton onClick={() => { setVideoToEdit(null); setShowUploadModal(true); }} className="px-5 py-2 rounded-full text-sm flex items-center gap-2 ml-2">
                  <Plus className="w-4 h-4" /><span className="hidden sm:inline">新增影片</span>
                </GlassButton>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeTab === 'playlists' && !isSharedMode && (
          <PlaylistManager videos={videos} playlists={playlists} appId={appId} allTags={allTags} />
        )}

        {(activeTab === 'home' || activeTab === 'shared') && (
          <>
            {isSharedMode && sharedPlaylistData && (
                <div className="mb-10 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
                   <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-3 relative z-10">{sharedPlaylistData.title}</h1>
                   <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-6"></div>
                   <p className="text-gray-300 mb-6 text-lg relative z-10">{sharedPlaylistData.description}</p>
                   <div className="flex items-center gap-6 text-sm text-gray-400 relative z-10">
                       <span className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full"><List className="w-4 h-4 text-blue-400" /> 共 {filteredVideos.length} 部影片</span>
                       <span className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full"><Calendar className="w-4 h-4 text-purple-400" /> 建立於 {formatDate(sharedPlaylistData.createdAt)}</span>
                   </div>
                </div>
            )}

            {!isSharedMode && (
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 flex-1 w-full">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedTag(null)} className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 ${!selectedTag ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-white/5 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/10'}`}>全部顯示</motion.button>
                  {allTags.map(tag => (
                    <div key={tag} className={`flex items-center pl-4 pr-1 py-1 rounded-full text-sm whitespace-nowrap transition-all border shrink-0 ${tag === selectedTag ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 backdrop-blur-md text-gray-300 border-white/10 hover:bg-white/10'}`}>
                        <span className="cursor-pointer mr-2 font-medium py-1" onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}>#{tag}</span>
                        <motion.button whileHover={{ scale: 1.2, backgroundColor: "rgba(239, 68, 68, 0.2)" }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteGlobalTag(tag)} className="text-gray-400 hover:text-red-400 p-1.5 rounded-full transition-colors" title="徹底刪除此標籤">
                            <X className="w-3.5 h-3.5" />
                        </motion.button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-white/5 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-lg">
                  <ArrowUpDown className="w-4 h-4 text-gray-400 ml-3" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-sm font-medium text-white cursor-pointer focus:outline-none pr-4 py-1.5 appearance-none"
                  >
                    <option value="date_desc" className="bg-gray-900 text-white">最新上傳優先</option>
                    <option value="date_asc" className="bg-gray-900 text-white">最舊上傳優先</option>
                    <option value="title_asc" className="bg-gray-900 text-white">筆畫/字母 (由少到多)</option>
                    <option value="title_desc" className="bg-gray-900 text-white">筆畫/字母 (由多到少)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map(video => (
                <VideoCard key={video.id} video={video} onClick={() => setCurrentVideo(video)} isAdmin={isAdmin} onDelete={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', video.id)); }} onEdit={(e, v) => { e.stopPropagation(); setVideoToEdit(v); setShowUploadModal(true); }} />
              ))}
            </div>
            
            {!isSharedMode && filteredVideos.length === 0 && (
                <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 mt-8">
                    <Film className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-xl text-gray-400 font-medium">找不到符合條件的影片</p>
                </div>
            )}
          </>
        )}
      </main>
      
      {showUploadModal && <UploadModal onClose={() => { setShowUploadModal(false); setVideoToEdit(null); }} appId={appId} existingTags={allTags} videoToEdit={videoToEdit} db={db} />}
      {currentVideo && <PlayerModal video={currentVideo} onClose={() => setCurrentVideo(null)} />}
    </div>
  );
}

// --- Video Card Component ---
const VideoCard = ({ video, onClick, isAdmin, onDelete, onEdit }) => {
  return (
    <GlassCard onClick={onClick} className="flex flex-col h-full relative group">
      {isAdmin && (
        <div className="absolute top-3 left-3 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => onEdit(e, video)} className="bg-black/60 backdrop-blur-md border border-white/20 hover:bg-blue-500 text-white p-2.5 rounded-full shadow-lg"><Pencil className="w-4 h-4" /></motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { if(confirm('確定刪除這部影片？')) onDelete(e, video.id); }} className="bg-black/60 backdrop-blur-md border border-white/20 hover:bg-red-500 text-white p-2.5 rounded-full shadow-lg"><Trash2 className="w-4 h-4" /></motion.button>
        </div>
      )}
      <div className="relative aspect-video bg-black/50 overflow-hidden border-b border-white/10">
        <img src={video.thumbUrl || "https://placehold.co/600x400/000000/FFF?text=No+Thumbnail"} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"/>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20 backdrop-blur-[2px]">
          <div className="bg-white/20 backdrop-blur-md border border-white/30 p-4 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <Play className="w-8 h-8 text-white fill-current pl-1" />
          </div>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1 bg-gradient-to-b from-white/[0.02] to-transparent">
        <h3 className="text-base font-bold text-white/90 line-clamp-2 mb-3 group-hover:text-blue-400 transition-colors leading-snug">{video.title}</h3>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {video.tags?.map(tag => <span key={tag} className="text-xs font-medium text-blue-200 bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">#{tag}</span>)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-auto pt-4 border-t border-white/5">
            <Calendar className="w-3.5 h-3.5" /> {formatDate(video.createdAt)}
        </div>
      </div>
    </GlassCard>
  );
};

// --- Player Modal ---
const PlayerModal = ({ video, onClose }) => {
  const embedInfo = getEmbedInfo(video.url);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-0 md:p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full h-full md:h-auto md:max-h-[90vh] max-w-5xl bg-[#151822]/90 backdrop-blur-3xl md:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col border border-white/10"
      >
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-white/10 shrink-0 bg-white/5">
          <h2 className="text-lg font-bold text-white truncate pr-4">{video.title}</h2>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="text-gray-400 hover:text-white bg-white/10 p-2 rounded-full border border-white/10"><X className="w-5 h-5" /></motion.button>
        </div>
        <div className="relative bg-black w-full aspect-video flex items-center justify-center shadow-inner">
          {embedInfo?.type === 'native' ? (
             <video src={video.url} className="w-full h-full" controls autoPlay />
          ) : (
            <iframe width="100%" height="100%" src={embedInfo?.src} title="Player" frameBorder="0" allowFullScreen className="w-full h-full"></iframe>
          )}
        </div>
        <div className="p-6 bg-transparent overflow-y-auto flex-1">
            <h4 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2 uppercase tracking-wider"><List className="w-4 h-4"/> 影片說明</h4>
            <p className="text-base text-gray-300 whitespace-pre-wrap leading-relaxed">{video.description || "尚無描述內容"}</p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Upload Modal ---
const UploadModal = ({ onClose, appId, existingTags, videoToEdit, db }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title || ''); setDesc(videoToEdit.description || '');
      setVideoUrl(videoToEdit.url || ''); setThumbUrl(videoToEdit.thumbUrl || '');
      setTags(videoToEdit.tags || []);
    }
  }, [videoToEdit]);

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
    const embedInfo = getEmbedInfo(newUrl);
    if (embedInfo?.type === 'youtube') setThumbUrl(getYouTubeThumbnail(embedInfo.id));
    else if (thumbUrl.includes('img.youtube.com')) setThumbUrl('');
  };

  const handleThumbUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setThumbUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { title, description: desc, url: videoUrl, thumbUrl, tags };
      if (videoToEdit) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoToEdit.id), { ...payload, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), { ...payload, createdAt: new Date().toISOString() });
      }
      onClose();
    } catch (error) { alert("儲存失敗：" + error.message); } 
    finally { setLoading(false); }
  };

  const availableTags = existingTags.filter(t => !tags.includes(t));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-0 md:p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#151822]/90 backdrop-blur-3xl md:rounded-3xl w-full h-full md:h-auto md:max-w-4xl p-6 md:p-10 border border-white/10 overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex justify-between items-center mb-8 pb-5 border-b border-white/10">
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
            {videoToEdit ? <div className="bg-blue-500/20 p-2 rounded-xl"><Pencil className="w-6 h-6 text-blue-400" /></div> : <div className="bg-green-500/20 p-2 rounded-xl"><Plus className="w-6 h-6 text-green-400" /></div>} 
            {videoToEdit ? '編輯影片內容' : '新增影片至資料庫'}
          </h2>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-full p-2"><X className="w-6 h-6" /></motion.button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">影片 URL</label>
                <input required type="url" value={videoUrl} onChange={handleUrlChange} placeholder="支援 YouTube, FB, IG, TikTok..." className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:bg-white/5 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">標題</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:bg-white/5 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">說明</label>
                <textarea rows="5" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:bg-white/5 transition-all shadow-inner"></textarea>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">封面縮圖</label>
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-white/10 border-dashed rounded-2xl cursor-pointer bg-black/30 hover:bg-white/5 transition-all relative overflow-hidden group shadow-inner">
                  {thumbUrl ? (
                      <>
                        <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300" />
                        <span className="absolute text-white font-bold opacity-0 group-hover:opacity-100 drop-shadow-lg bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">更換圖片</span>
                      </>
                  ) : (
                      <div className="flex flex-col items-center text-gray-500"><ImageIcon className="w-10 h-10 mb-3 text-gray-400"/><span>點擊上傳封面，或輸入網址自動抓取</span></div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbUpload} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">標籤管理</label>
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); setNewTag(''); } } }} placeholder="輸入標籤後按 Enter 加入..." className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 focus:bg-white/5 transition-all shadow-inner" />
                
                <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] bg-black/20 p-3 rounded-xl border border-white/5">
                  {tags.map(tag => (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} key={tag} className="bg-blue-600 border border-blue-400 text-white text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                          #{tag} <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-300 bg-black/20 rounded-full p-0.5"><X className="w-3.5 h-3.5" /></button>
                      </motion.span>
                  ))}
                  {tags.length === 0 && <span className="text-gray-500 text-sm flex items-center">尚未加入任何標籤</span>}
                </div>
                
                {availableTags.length > 0 && (
                  <div className="mt-2 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider">點擊快速加入現有標籤</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={tag} type="button" onClick={() => setTags([...tags, tag])} className="bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-full text-sm font-medium transition-colors">
                          + {tag}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-8 mt-6 border-t border-white/10 gap-4">
            <GlassButton onClick={onClose} className="px-6 py-3 rounded-xl text-gray-300 font-bold">取消編輯</GlassButton>
            <GlassButton type="submit" disabled={loading} className="!bg-blue-600 !border-blue-400 hover:!bg-blue-500 px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                {loading ? '處理中...' : '儲存變更'}
            </GlassButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Playlist Manager ---
const PlaylistManager = ({ videos, playlists, appId, allTags }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [justCopied, setJustCopied] = useState(null);
  const [filterTag, setFilterTag] = useState(null);

  const openCreateModal = () => { setEditingPlaylistId(null); setNewTitle(''); setNewDesc(''); setSelectedVideoIds([]); setFilterTag(null); setShowCreate(true); };
  const openEditModal = (pl) => { setEditingPlaylistId(pl.id); setNewTitle(pl.title); setNewDesc(pl.description || ''); setSelectedVideoIds(pl.videoIds || []); setFilterTag(null); setShowCreate(true); };
  const closeEditModal = () => { setShowCreate(false); setEditingPlaylistId(null); setNewTitle(''); setNewDesc(''); setSelectedVideoIds([]); };

  const handleSavePlaylist = async () => {
    if (!newTitle || selectedVideoIds.length === 0) return;
    try {
      if (editingPlaylistId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', editingPlaylistId), { title: newTitle, description: newDesc, videoIds: selectedVideoIds, updatedAt: new Date().toISOString() });
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), { title: newTitle, description: newDesc, videoIds: selectedVideoIds, createdAt: new Date().toISOString() });
      closeEditModal();
    } catch (e) { alert('儲存失敗'); }
  };

  const copyLink = (id) => {
    const link = `${window.location.origin}${window.location.pathname}#playlist/${id}`;
    navigator.clipboard.writeText(link).then(() => { setJustCopied(id); setTimeout(() => setJustCopied(null), 2000); });
  };

  const displayedVideos = videos.filter(v => filterTag ? v.tags?.includes(filterTag) : true);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center mb-8 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-purple-500/20 rounded-full blur-[50px]"></div>
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 relative z-10">播放清單管理</h2>
        <GlassButton onClick={openCreateModal} className="!bg-green-600/80 hover:!bg-green-500 !border-green-400 px-6 py-3 rounded-full flex items-center gap-2 font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)] relative z-10">
          <Plus className="w-5 h-5" /> 建立新清單
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {playlists.map(pl => (
          <GlassCard key={pl.id} className="p-6 flex flex-col relative group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold truncate pr-2 text-white/90 group-hover:text-white transition-colors">{pl.title}</h3>
              <div className="flex gap-2 shrink-0 bg-black/40 backdrop-blur-md rounded-xl p-1.5 border border-white/5">
                 <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(pl)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></motion.button>
                 <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { if(confirm('確定刪除這個清單嗎？')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', pl.id)); }} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></motion.button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6 line-clamp-2 min-h-[2.5rem] leading-relaxed">{pl.description || "無說明內容"}</p>
            
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-6 font-medium border-t border-white/5 pt-4">
                <span className="flex items-center gap-1.5"><Film className="w-4 h-4 text-blue-400" /> {pl.videoIds?.length || 0} 部影片</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-purple-400" /> {formatDate(pl.createdAt)}</span>
            </div>

            <div className="mt-auto">
              <GlassButton onClick={() => copyLink(pl.id)} className={`w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 font-bold transition-all ${justCopied === pl.id ? '!bg-green-600 !border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''}`}>
                {justCopied === pl.id ? <Check className="w-5 h-5"/> : <Share2 className="w-5 h-5"/>} 
                {justCopied === pl.id ? '已複製分享連結！' : '複製專屬分享連結'}
              </GlassButton>
            </div>
          </GlassCard>
        ))}
        {playlists.length === 0 && <div className="col-span-full py-20 text-center text-gray-500 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">尚未建立任何播放清單</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-0 md:p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-[#151822]/90 backdrop-blur-3xl md:rounded-3xl w-full max-w-5xl p-6 md:p-10 border border-white/10 max-h-[95vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-2xl font-extrabold mb-8 shrink-0 flex items-center gap-3 text-white border-b border-white/10 pb-5">
                <div className="bg-purple-500/20 p-2 rounded-xl"><List className="w-6 h-6 text-purple-400" /></div> 
                {editingPlaylistId ? '編輯播放清單' : '建立分享清單'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 shrink-0">
                <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">清單名稱 *</label>
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:bg-white/5 transition-all shadow-inner" placeholder="例如：新進員工教育訓練" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">清單說明 (選填)</label>
                    <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:bg-white/5 transition-all shadow-inner" placeholder="簡單描述此清單的內容..." />
                </div>
            </div>

            {allTags.length > 0 && (
                <div className="mb-6 shrink-0 overflow-x-auto no-scrollbar bg-white/5 p-4 rounded-2xl border border-white/10 shadow-inner">
                    <div className="flex gap-3 items-center">
                        <span className="text-sm font-bold text-gray-400 flex items-center gap-2 mr-2 uppercase tracking-wider"><Filter className="w-4 h-4"/> 影片過濾</span>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setFilterTag(null)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${!filterTag ? 'bg-white text-black shadow-lg' : 'bg-black/30 text-gray-300 border border-white/5 hover:bg-white/10'}`}>全部顯示</motion.button>
                        {allTags.map(tag => (
                            <motion.button whileTap={{ scale: 0.9 }} key={tag} onClick={() => setFilterTag(tag === filterTag ? null : tag)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${tag === filterTag ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-black/30 text-gray-300 border-white/5 hover:bg-white/10'}`}>#{tag}</motion.button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto mb-8 border border-white/10 rounded-2xl bg-black/30 p-5 shadow-inner min-h-[30vh]">
               <h3 className="text-sm font-bold text-gray-300 mb-4 flex justify-between items-center">
                   <span>勾選要加入的影片</span>
                   <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs border border-purple-500/30">{selectedVideoIds.length} 已選 / {displayedVideos.length} 總共</span>
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedVideos.map(v => (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={v.id} onClick={() => setSelectedVideoIds(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])}
                      className={`cursor-pointer p-4 rounded-2xl border flex items-center gap-4 transition-all ${selectedVideoIds.includes(v.id) ? 'border-purple-500 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'border-white/5 hover:border-white/20 bg-white/5'}`}>
                      <div className={`w-6 h-6 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${selectedVideoIds.includes(v.id) ? 'bg-purple-500 border-purple-400 shadow-lg' : 'border-gray-500 bg-black/50'}`}>
                        {selectedVideoIds.includes(v.id) && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="truncate flex-1">
                          <div className={`text-sm font-bold truncate mb-1 ${selectedVideoIds.includes(v.id) ? 'text-white' : 'text-gray-300'}`}>{v.title}</div>
                          <div className="text-xs text-gray-500 truncate">{v.tags?.join(', ') || '無標籤'}</div>
                      </div>
                    </motion.div>
                  ))}
                  {displayedVideos.length === 0 && <div className="col-span-full text-center text-gray-500 py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">沒有符合標籤條件的影片</div>}
               </div>
            </div>

            <div className="flex justify-end gap-4 shrink-0 pt-6 border-t border-white/10">
              <GlassButton onClick={closeEditModal} className="px-6 py-3 rounded-xl text-gray-300 font-bold">取消</GlassButton>
              <GlassButton onClick={handleSavePlaylist} disabled={!newTitle || selectedVideoIds.length === 0} className="!bg-purple-600 !border-purple-400 hover:!bg-purple-500 px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                 {editingPlaylistId ? '儲存變更' : '建立並儲存'}
              </GlassButton>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};