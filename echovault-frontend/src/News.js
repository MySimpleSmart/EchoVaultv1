import React, { useState, useEffect } from 'react';

function News() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // First, get the category ID for "system-news" slug
        const categoryResp = await fetch(
          'https://yourfinservices.com.au/wp-json/wp/v2/categories?slug=system-news',
          { mode: 'cors' }
        );
        
        let categoryId = null;
        if (categoryResp.ok) {
          const categories = await categoryResp.json();
          if (categories && categories.length > 0) {
            categoryId = categories[0].id;
          }
        }
        
        // Fetch posts from the external site
        // If category found, filter by category, otherwise fetch all posts
        const postsUrl = categoryId
          ? `https://yourfinservices.com.au/wp-json/wp/v2/posts?categories=${categoryId}&per_page=20&_embed`
          : 'https://yourfinservices.com.au/wp-json/wp/v2/posts?per_page=20&_embed';
        
        const resp = await fetch(postsUrl, {
          mode: 'cors'
        });
        
        if (!resp.ok) {
          throw new Error('Failed to load news');
        }
        
        const data = await resp.json();
        setPosts(data || []);
      } catch (e) {
        console.error('Error loading news:', e);
        setError(e.message || 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-gray-600">Latest updates and announcements.</p>
          </div>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading news...</p>}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">{error}</p>
          <p className="text-xs text-yellow-600 mt-1">
            Unable to load news from external source. Please try again later.
          </p>
        </div>
      )}
      
      {!loading && !error && posts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No news articles found.</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => {
          // Get featured image if available - try multiple paths
          const getFeaturedImage = (post) => {
            if (!post) return null;
            
            // Try embedded media
            const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
            if (embeddedMedia) {
              // Try source_url first
              if (embeddedMedia.source_url) return embeddedMedia.source_url;
              // Try media_details sizes
              if (embeddedMedia.media_details?.sizes) {
                const sizes = embeddedMedia.media_details.sizes;
                // Try large, medium_large, medium, or full
                if (sizes.large?.source_url) return sizes.large.source_url;
                if (sizes['medium_large']?.source_url) return sizes['medium_large'].source_url;
                if (sizes.medium?.source_url) return sizes.medium.source_url;
                if (sizes.full?.source_url) return sizes.full.source_url;
              }
            }
            
            // Try direct featured_media_url
            if (post.featured_media_url) return post.featured_media_url;
            
            return null;
          };
          
          const featuredImage = getFeaturedImage(post);
          
          // Get excerpt or content
          const excerpt = post.excerpt?.rendered || post.content?.rendered || '';
          // Strip HTML tags for preview (keep first 120 chars for grid layout)
          const textContent = excerpt.replace(/<[^>]*>/g, '').substring(0, 120);
          
          return (
            <article key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              {featuredImage && (
                <div className="w-full h-40 overflow-hidden bg-gray-100">
                  <img 
                    src={featuredImage} 
                    alt={post.title?.rendered || 'News image'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
                  {post.title?.rendered || 'News'}
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(post.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
                <div className="text-xs text-gray-600 mb-3 flex-1 line-clamp-3">
                  {textContent}
                  {textContent.length >= 120 && '...'}
                </div>
                {post.link && (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium mt-auto"
                  >
                    Read more
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default News;
