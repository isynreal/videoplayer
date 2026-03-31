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
  Facebook, Video, Filter, Instagram, Twitter, AtSign, Calendar
} from 'lucide-react';

const APP_VERSION = "1.0.5"; // 🌟 新增標籤刪除功能、調整分享模式 Logo

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
  if (ytMatch && ytMatch[2].length === 11) {
    return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[2]}?autoplay=1`, id: ytMatch[2] };
  }

  const vimeoRegExp = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
  }

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

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [sharedPlaylistId, setSharedPlaylistId] = useState(null);
  const [sharedPlaylistData, setSharedPlaylistData] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error("登入失敗:", e); }
    };
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
    const unsubVideos = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), orderBy('createdAt', 'desc')), 
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
    const tags = new Set();
    videos.forEach(v => v.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'zh-TW')); 
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let source = videos;
    if (activeTab === 'shared' && sharedPlaylistData) source = videos.filter(v => sharedPlaylistData.videoIds.includes(v.id));
    else if (activeTab === 'shared' && !sharedPlaylistData) return [];
    
    return source.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag ? v.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    });
  }, [videos, searchQuery, selectedTag, activeTab, sharedPlaylistData]);
  
  // 🌟 新增：全域刪除標籤功能
  const handleDeleteGlobalTag = async (tagToDelete) => {
    if (!confirm(`確定要從系統中徹底刪除「#${tagToDelete}」標籤嗎？\n\n(此動作會將該標籤從所有關聯的影片中移除)`)) return;
    
    // 找出所有包含此標籤的影片
    const videosToUpdate = videos.filter(v => v.tags?.includes(tagToDelete));
    
    try {
      const updatePromises = videosToUpdate.map(v => {
        const newTags = v.tags.filter(t => t !== tagToDelete);
        return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', v.id), { tags: newTags });
      });
      await Promise.all(updatePromises);
      
      // 如果正在篩選這個標籤，則取消篩選
      if (selectedTag === tagToDelete) setSelectedTag(null);
    } catch (error) {
      alert("刪除標籤失敗：" + error.message);
    }
  };

  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-4">正在連線至資料庫...</div>;

  const isSharedMode = activeTab === 'shared';
  const isAdmin = !isSharedMode;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-10">
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center cursor-pointer flex-shrink-0 mr-4" onClick={() => {
                if (!isSharedMode) { setActiveTab('home'); setSharedPlaylistId(null); setSearchQuery(''); setSelectedTag(null); window.location.hash = ''; }
              }}>
              {/* 🌟 修改：Logo 統一在所有模式顯示，且加上白色半透明底板以適應黑字 */}
              <img src="/logo.png" alt="iSynReal Logo" className="h-8 md:h-9 object-contain bg-white/90 px-2 py-1 rounded" />
              {isSharedMode && (
                  <span className="font-bold text-lg md:text-xl tracking-tight text-white border-l-2 border-gray-600 pl-3 ml-3">
                      {sharedPlaylistData?.title || '播放清單'}
                  </span>
              )}
            </div>

            {!isSharedMode && (
              <div className="flex-1 max-w-md mx-4 hidden md:block">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-full bg-gray-700 text-white focus:outline-none focus:border-blue-500 sm:text-sm" placeholder="搜尋影片..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            )}

            {!isSharedMode && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 md:overflow-visible">
                <button onClick={() => setActiveTab('home')} className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'home' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>影片庫</button>
                <button onClick={() => setActiveTab('playlists')} className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'playlists' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>播放清單</button>
                <button onClick={() => { setVideoToEdit(null); setShowUploadModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap ml-2 shadow-lg">
                  <Plus className="w-4 h-4" /><span className="hidden sm:inline">新增影片</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'playlists' && !isSharedMode && (
          <PlaylistManager videos={videos} playlists={playlists} appId={appId} allTags={allTags} />
        )}

        {(activeTab === 'home' || activeTab === 'shared') && (
          <>
            {isSharedMode && sharedPlaylistData && (
                <div className="mb-8 bg-gray-800 rounded-xl border border-gray-700 p-6">
                   <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{sharedPlaylistData.title}</h1>
                   <div className="h-1 w-20 bg-blue-500 rounded-full mb-4"></div>
                   <p className="text-gray-300 mb-4">{sharedPlaylistData.description}</p>
                   <div className="flex items-center gap-4 text-sm text-gray-500">
                       <span className="flex items-center gap-1"><List className="w-4 h-4" /> 共 {filteredVideos.length} 部影片</span>
                       <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> 建立於 {formatDate(sharedPlaylistData.createdAt)}</span>
                   </div>
                </div>
            )}

            {/* 🌟 修改：標籤過濾區新增刪除 (X) 按鈕 */}
            {!isSharedMode && allTags.length > 0 && (
              <div className="mb-6 overflow-x-auto no-scrollbar pb-2">
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTag(null)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedTag ? 'bg-white text-gray-900 shadow' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>全部顯示</button>
                  {allTags.map(tag => (
                    <div key={tag} className={`flex items-center pl-3 pr-1 py-1 rounded-full text-sm whitespace-nowrap transition-colors border ${tag === selectedTag ? 'bg-blue-600 text-white border-blue-500 shadow' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
                        <span className="cursor-pointer mr-1" onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}>#{tag}</span>
                        <button onClick={() => handleDeleteGlobalTag(tag)} className="hover:text-red-300 hover:bg-black/20 p-1 rounded-full transition-colors" title="徹底刪除此標籤">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map(video => (
                <VideoCard key={video.id} video={video} onClick={() => setCurrentVideo(video)} isAdmin={isAdmin} onDelete={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', video.id)); }} onEdit={(e, v) => { e.stopPropagation(); setVideoToEdit(v); setShowUploadModal(true); }} />
              ))}
            </div>
          </>
        )}
      </main>
      
      {showUploadModal && <UploadModal onClose={() => { setShowUploadModal(false); setVideoToEdit(null); }} appId={appId} existingTags={allTags} videoToEdit={videoToEdit} db={db} />}
      {currentVideo && <PlayerModal video={currentVideo} onClose={() => setCurrentVideo(null)} />}
    </div>
  );
}

const VideoCard = ({ video, onClick, isAdmin, onDelete, onEdit }) => {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer border border-gray-700 flex flex-col relative" onClick={onClick}>
      {isAdmin && (
        <div className="absolute top-2 left-2 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200">
          <button onClick={(e) => onEdit(e, video)} className="bg-gray-900/80 hover:bg-blue-600 text-white p-2 rounded-full shadow-md"><Pencil className="w-4 h-4" /></button>
          <button onClick={(e) => { if(confirm('確定刪除這部影片？')) onDelete(e, video.id); }} className="bg-gray-900/80 hover:bg-red-600 text-white p-2 rounded-full shadow-md"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      <div className="relative aspect-video bg-black overflow-hidden border-b border-gray-700">
        <img src={video.thumbUrl || "https://placehold.co/600x400/000000/FFF?text=No+Thumbnail"} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"/>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><div className="bg-blue-600 p-3 rounded-full shadow-lg"><Play className="w-8 h-8 text-white fill-current pl-1" /></div></div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-white line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors leading-snug">{video.title}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2 mt-auto">
            <Calendar className="w-3 h-3" /> {formatDate(video.createdAt)}
        </div>
        <div className="flex flex-wrap gap-1">
          {video.tags?.map(tag => <span key={tag} className="text-xs text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/50">#{tag}</span>)}
        </div>
      </div>
    </div>
  );
};

const PlayerModal = ({ video, onClose }) => {
  const embedInfo = getEmbedInfo(video.url);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:h-auto md:max-h-[95vh] max-w-5xl bg-gray-900 md:rounded-xl overflow-hidden shadow-2xl flex flex-col border border-gray-700">
        <div className="flex justify-between items-center p-3 border-b border-gray-800 shrink-0 bg-gray-900">
          <h2 className="text-lg font-bold text-white truncate pr-4">{video.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 bg-gray-800 rounded-full"><X className="w-6 h-6" /></button>
        </div>
        <div className="relative bg-black w-full aspect-video flex items-center justify-center">
          {embedInfo?.type === 'native' ? (
             <video src={video.url} className="w-full h-full" controls autoPlay />
          ) : (
            <iframe width="100%" height="100%" src={embedInfo?.src} title="Player" frameBorder="0" allowFullScreen className="w-full h-full"></iframe>
          )}
        </div>
        <div className="p-5 bg-gray-900 overflow-y-auto flex-1">
            <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><List className="w-4 h-4"/> 影片說明</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{video.description || "尚無描述內容"}</p>
        </div>
      </div>
    </div>
  );
};

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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-gray-800 md:rounded-xl w-full h-full md:h-auto md:max-w-3xl p-6 border border-gray-700 overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {videoToEdit ? <Pencil className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />} {videoToEdit ? '編輯影片' : '新增影片'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-700 rounded-full p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片 URL</label>
                <input required type="url" value={videoUrl} onChange={handleUrlChange} placeholder="支援 YouTube, FB, IG, TikTok..." className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標題</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">說明</label>
                <textarea rows="4" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"></textarea>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">封面圖</label>
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-900 hover:bg-gray-700 transition-colors relative overflow-hidden group">
                  {thumbUrl ? (
                      <>
                        <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-50 transition-opacity" />
                        <span className="absolute text-white font-bold opacity-0 group-hover:opacity-100 drop-shadow-md">更換圖片</span>
                      </>
                  ) : (
                      <div className="flex flex-col items-center text-gray-500"><ImageIcon className="w-8 h-8 mb-2"/><span>點擊上傳封面</span></div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbUpload} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標籤 (輸入後按 Enter)</label>
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); setNewTag(''); } } }} placeholder="新增標籤..." className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white mb-3 focus:outline-none focus:border-blue-500" />
                <div className="flex flex-wrap gap-2 mb-3 min-h-[30px]">
                  {tags.map(tag => <span key={tag} className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">{tag} <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-300 ml-1"><X className="w-3 h-3" /></button></span>)}
                  {tags.length === 0 && <span className="text-gray-600 text-sm">尚未加入任何標籤</span>}
                </div>
                
                {availableTags.length > 0 && (
                  <div className="text-xs mt-2 p-3 bg-gray-900 rounded-lg border border-gray-700">
                    <p className="text-gray-400 mb-2">快速加入現有標籤：</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button key={tag} type="button" onClick={() => setTags([...tags, tag])} className="bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-full transition-colors">
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-6 mt-4 border-t border-gray-700 gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors font-medium">取消</button>
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50">{loading ? '處理中...' : '儲存變更'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PlaylistManager = ({ videos, playlists, appId, allTags }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [justCopied, setJustCopied] = useState(null);
  const [filterTag, setFilterTag] = useState(null);

  const openCreateModal = () => {
    setEditingPlaylistId(null); setNewTitle(''); setNewDesc(''); setSelectedVideoIds([]); setFilterTag(null); setShowCreate(true);
  };

  const openEditModal = (pl) => {
    setEditingPlaylistId(pl.id); setNewTitle(pl.title); setNewDesc(pl.description || ''); setSelectedVideoIds(pl.videoIds || []); setFilterTag(null); setShowCreate(true);
  };

  const closeEditModal = () => {
    setShowCreate(false); setEditingPlaylistId(null); setNewTitle(''); setNewDesc(''); setSelectedVideoIds([]);
  };

  const handleSavePlaylist = async () => {
    if (!newTitle || selectedVideoIds.length === 0) return;
    const db = getFirestore();
    try {
      if (editingPlaylistId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', editingPlaylistId), {
          title: newTitle, description: newDesc, videoIds: selectedVideoIds, updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), {
          title: newTitle, description: newDesc, videoIds: selectedVideoIds, createdAt: new Date().toISOString()
        });
      }
      closeEditModal();
    } catch (e) { alert('儲存失敗'); }
  };

  const copyLink = (id) => {
    const link = `${window.location.origin}${window.location.pathname}#playlist/${id}`;
    navigator.clipboard.writeText(link).then(() => { setJustCopied(id); setTimeout(() => setJustCopied(null), 2000); });
  };

  const displayedVideos = videos.filter(v => filterTag ? v.tags?.includes(filterTag) : true);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">播放清單管理</h2>
        <button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-colors shadow-lg font-medium">
          <Plus className="w-5 h-5" /> 建立新清單
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map(pl => (
          <div key={pl.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col shadow-lg hover:border-gray-500 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-bold truncate pr-2 text-white">{pl.title}</h3>
              <div className="flex gap-1 shrink-0 bg-gray-900 rounded-lg p-1">
                 <button onClick={() => openEditModal(pl)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-md transition-colors" title="編輯"><Pencil className="w-4 h-4" /></button>
                 <button onClick={() => { if(confirm('確定刪除這個清單嗎？')) deleteDoc(doc(getFirestore(), 'artifacts', appId, 'public', 'data', 'playlists', pl.id)); }} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-md transition-colors" title="刪除"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem] leading-relaxed">{pl.description || "無說明內容"}</p>
            
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-5 font-medium">
                <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {pl.videoIds?.length || 0} 部影片</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(pl.createdAt)}</span>
            </div>

            <div className="mt-auto">
              <button onClick={() => copyLink(pl.id)} className={`w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 font-medium transition-colors ${justCopied === pl.id ? 'bg-green-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}>
                {justCopied === pl.id ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>} 
                {justCopied === pl.id ? '已複製分享連結！' : '複製專屬分享連結'}
              </button>
            </div>
          </div>
        ))}
        {playlists.length === 0 && <div className="col-span-full py-10 text-center text-gray-500">尚未建立任何播放清單</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 md:p-8 border border-gray-700 max-h-[90vh] flex flex-col shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 shrink-0 flex items-center gap-2">
                <List className="w-6 h-6 text-blue-500" /> {editingPlaylistId ? '編輯播放清單' : '建立分享清單'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 shrink-0">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">清單名稱 *</label>
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="例如：新進員工教育訓練" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">清單說明 (選填)</label>
                    <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="簡單描述此清單的內容..." />
                </div>
            </div>

            {allTags.length > 0 && (
                <div className="mb-4 shrink-0 overflow-x-auto no-scrollbar bg-gray-900 p-3 rounded-lg border border-gray-700">
                    <div className="flex gap-2 items-center">
                        <span className="text-sm font-medium text-gray-400 flex items-center gap-1 mr-2"><Filter className="w-4 h-4"/> 影片過濾：</span>
                        <button onClick={() => setFilterTag(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!filterTag ? 'bg-white text-gray-900 shadow' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>全部顯示</button>
                        {allTags.map(tag => (
                            <button key={tag} onClick={() => setFilterTag(tag === filterTag ? null : tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tag === filterTag ? 'bg-blue-600 text-white shadow' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>#{tag}</button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto mb-6 border border-gray-700 rounded-lg bg-gray-900 p-4">
               <h3 className="text-sm font-medium text-gray-400 mb-3">勾選要加入的影片 ({selectedVideoIds.length} 已選 / {displayedVideos.length} 總共)：</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedVideos.map(v => (
                    <div key={v.id} onClick={() => setSelectedVideoIds(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])}
                      className={`cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-colors ${selectedVideoIds.includes(v.id) ? 'border-blue-500 bg-blue-900/30 shadow-inner' : 'border-gray-700 hover:border-gray-500 bg-gray-800'}`}>
                      <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${selectedVideoIds.includes(v.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-500 bg-gray-900'}`}>
                        {selectedVideoIds.includes(v.id) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="truncate flex-1">
                          <div className={`text-sm font-medium truncate ${selectedVideoIds.includes(v.id) ? 'text-white' : 'text-gray-300'}`}>{v.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{v.tags?.join(', ') || '無標籤'}</div>
                      </div>
                    </div>
                  ))}
                  {displayedVideos.length === 0 && <div className="col-span-full text-center text-gray-500 py-8 bg-gray-800 rounded-lg border border-dashed border-gray-700">沒有符合標籤條件的影片</div>}
               </div>
            </div>

            <div className="flex justify-end gap-3 shrink-0 pt-4 border-t border-gray-700">
              <button onClick={closeEditModal} className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg font-medium transition-colors">取消</button>
              <button onClick={handleSavePlaylist} disabled={!newTitle || selectedVideoIds.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium shadow-lg disabled:opacity-50 transition-colors">
                 {editingPlaylistId ? '儲存變更' : '建立並儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};