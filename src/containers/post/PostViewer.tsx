import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
} from 'react';
import { useDispatch } from 'react-redux';
import {
  READ_POST,
  SinglePost,
  REMOVE_POST,
  LIKE_POST,
  UNLIKE_POST,
  LinkedPost,
  POST_VIEW,
} from '../../lib/graphql/post';
import PostHead from '../../components/post/PostHead';
import PostContent from '../../components/post/PostContent';
import PostComments from './PostComments';
import postSlice from '../../modules/post';
import PostViewerProvider from '../../components/post/PostViewerProvider';
import useUser, { useUserId } from '../../lib/hooks/useUser';
import { useQuery, useMutation, useApolloClient } from '@apollo/react-hooks';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { prepareEdit } from '../../modules/write';
import PostLikeShareButtons from '../../components/post/PostLikeShareButtons';
import gql from 'graphql-tag';
import { shareFacebook, shareTwitter, copyText } from '../../lib/share';
import PostToc from '../../components/post/PostToc';
import LinkedPostList from '../../components/post/LinkedPostList';
import { getScrollTop, ssrEnabled } from '../../lib/utils';
import UserProfile from '../../components/common/UserProfile';
import VelogResponsive from '../../components/velog/VelogResponsive';
import styled from 'styled-components';
import PostSkeleton from '../../components/post/PostSkeleton';
import media from '../../lib/styles/media';
import useNotFound from '../../lib/hooks/useNotFound';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import MobileLikeButton from '../../components/post/MobileLikeButton';
import RelatedPost from './RelatedPost';
import optimizeImage from '../../lib/optimizeImage';
import { useSetShowFooter } from '../../components/velog/VelogPageTemplate';
import HorizontalBanner from './HorizontalBanner';
import gtag from '../../lib/gtag';
import FollowButton from '../../components/common/FollowButton';
import { BANNER_ADS } from '../../lib/graphql/ad';
import PostBanner from '../../components/post/PostBanner';

const UserProfileWrapper = styled(VelogResponsive)`
  margin-top: 16rem;
  margin-bottom: 6rem;
  ${media.medium} {
    margin-top: 8rem;
    margin-bottom: 3rem;
  }
  ${media.small} {
    margin-top: 2rem;
  }
`;

export interface PostViewerOwnProps {
  username: string;
  urlSlug: string;
}
export interface PostViewerProps
  extends PostViewerOwnProps,
    RouteComponentProps {}

const PostViewer: React.FC<PostViewerProps> = ({
  username,
  urlSlug,
  history,
  match,
}) => {
  const setShowFooter = useSetShowFooter();
  const [showRecommends, setShowRecommends] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [username, urlSlug]);
  const userId = useUserId();
  const dispatch = useDispatch();
  const readPost = useQuery<{ post: SinglePost }>(READ_POST, {
    variables: {
      username,
      url_slug: urlSlug,
    },
  });
  const client = useApolloClient();
  const prefetchPost = useCallback(
    ({ username, urlSlug }: { username: string; urlSlug: string }) => {
      client.query({
        query: READ_POST,
        variables: {
          username,
          url_slug: urlSlug,
        },
      });
    },
    [client],
  );
  const prefetched = useRef(false);

  const [removePost] = useMutation(REMOVE_POST);
  const [postView] = useMutation(POST_VIEW);
  const [likePost, { loading: loadingLike }] = useMutation(LIKE_POST);
  const [unlikePost, { loading: loadingUnlike }] = useMutation(UNLIKE_POST);
  const { showNotFound } = useNotFound();
  const { data: ads } = useQuery(BANNER_ADS, {
    variables: {
      writerUsername: username,
    },
  });

  const customAd = useMemo(() => {
    if (!ads) return null;
    if (ads.bannerAds.length === 0) return null;
    return {
      image: ads.bannerAds[0].image,
      url: ads.bannerAds[0].url,
    };
  }, [ads]);

  // const userLogo = useSelector((state: RootState) => state.header.userLogo);
  // const velogTitle = useMemo(() => {
  //   if (!userLogo || !userLogo.title) return `${username}.log`;
  //   return userLogo.title;
  // }, [userLogo, username]);
  const user = useUser();

  const { error, data } = readPost;

  useEffect(() => {
    if (data && data.post === null) {
      showNotFound();
      return;
    }
    if (!data || !data.post) return;
    postView({
      variables: {
        id: data.post.id,
      },
    });
  }, [data, postView, showNotFound]);

  if (ssrEnabled && data && data.post === null) {
    showNotFound();
  }

  const prefetchLinkedPosts = useCallback(() => {
    if (!data || !data.post) return;
    if (prefetched.current) return;
    prefetched.current = true;
    const { linked_posts: linkedPosts } = data.post;
    const { next, previous } = linkedPosts;
    const getVariables = (post: LinkedPost) => ({
      username: post.user.username,
      urlSlug: post.url_slug,
    });
    if (next) {
      prefetchPost(getVariables(next));
    }
    if (previous) {
      prefetchPost(getVariables(previous));
    }
  }, [data, prefetchPost]);

  const postReady = !!data?.post;

  useEffect(() => {
    setShowFooter(postReady);
  }, [setShowFooter, postReady]);

  useEffect(() => {
    return () => {
      setShowFooter(false);
    };
  }, [setShowFooter]);

  const onScroll = useCallback(() => {
    const scrollTop = getScrollTop();
    const { scrollHeight } = document.body;
    const { innerHeight } = window;
    const percentage = ((scrollTop + innerHeight) / scrollHeight) * 100;
    if (percentage > 50) {
      prefetchLinkedPosts();
    }
    if (percentage > 50 && postReady) {
      setShowRecommends(true);
    }
  }, [prefetchLinkedPosts, postReady]);

  useEffect(() => {
    if (!data) return;
    if (!data.post) return;

    // schedule post prefetch
    const timeoutId = setTimeout(prefetchLinkedPosts, 1000 * 5);

    dispatch(postSlice.actions.setPostId(data.post.id));

    prefetched.current = false;

    return () => {
      clearTimeout(timeoutId);
    };
  }, [data, dispatch, prefetchLinkedPosts]);

  useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);

  const shouldShowBanner = useMemo(() => {
    if (!data?.post) return;

    const post = data.post;
    const isOwnPost = post.user.id === userId;
    const isVeryOld =
      Date.now() - new Date(post.released_at).getTime() >
      1000 * 60 * 60 * 24 * 30;

    if (isOwnPost) return false;
    if (!isVeryOld) return false;
    return true;
  }, [data?.post, userId]);

  const shouldShowFooterBanner = useMemo(() => {
    if (shouldShowBanner) return false;
    if (!data?.post) return false;
    if (userId) return false;
    return true;
  }, [userId, data?.post]);

  useEffect(() => {
    if (!data?.post?.id) return;
    if (!shouldShowBanner) return;
    gtag('event', 'banner_view');
    console.log('banner_view');
    if (userId) {
      gtag('event', 'banner_view_user');
    }
  }, [data?.post?.id, shouldShowBanner, userId]);

  const onRemove = async () => {
    if (!data || !data.post) return;
    try {
      await removePost({
        variables: {
          id: data.post.id,
        },
      });
      history.push('/');
      await client.resetStore();
    } catch (e) {}
  };

  if (error) {
    console.log(error);
    return null;
  }

  const onEdit = () => {
    if (!data) return;
    const { post } = data;
    dispatch(
      prepareEdit({
        id: post.id,
        body: post.body,
        description: post.short_description,
        isMarkdown: post.is_markdown,
        isPrivate: post.is_private,
        series: post.series
          ? {
              id: post.series.id,
              name: post.series.name,
            }
          : null,
        tags: post.tags,
        title: post.title,
        urlSlug: post.url_slug,
        thumbnail: post.thumbnail,
      }),
    );
    history.push(`/write?id=${post.id}`);
  };

  const onOpenStats = () => {
    history.push(`/post-stats/${post.id}`);
  };

  const onLikeToggle = () => {
    if (loadingLike || loadingUnlike) return;

    const variables = {
      id: post.id,
    };
    const likeFragment = gql`
      fragment post on Post {
        liked
        likes
      }
    `;

    // IF SPLITTED TO ANOTHER CONTAINER
    // const data = client.readFragment<{ liked: boolean; likes: number }>({
    //   id: `Post:${post.id}`,
    //   fragment: likeFragment
    // });

    try {
      if (!user) {
        toast.error('로그인 후 이용해주세요.');
        return;
      }
      if (post.liked) {
        client.writeFragment({
          id: `Post:${post.id}`,
          fragment: likeFragment,
          data: {
            liked: false,
            likes: post.likes - 1,
            __typename: 'Post',
          },
        });
        unlikePost({
          variables,
        });
      } else {
        client.writeFragment({
          id: `Post:${post.id}`,
          fragment: likeFragment,
          data: {
            liked: true,
            likes: post.likes + 1,
            __typename: 'Post',
          },
        });
        likePost({
          variables,
        });
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onShareClick = (type: 'facebook' | 'twitter' | 'clipboard') => {
    const { url } = match;
    const link = `https://velog.io${url}`;

    switch (type) {
      case 'facebook':
        shareFacebook(link);
        break;
      case 'twitter':
        const ownPost = post.user.id === userId;
        const message = ownPost
          ? `제가 velog 에 게재한 "${post.title}" 포스트를 읽어보세요.`
          : `${post.user.username}님이 velog 에 게재한 "${post.title}" 포스트를 읽어보세요.`;

        shareTwitter(link, message);
        break;
      case 'clipboard':
        copyText(link);
        toast.success('링크가 복사되었습니다.');
        break;
      default:
    }
  };

  if (!data || !data.post) return <PostSkeleton />;

  const { post } = data;

  const isContentLongEnough = post.body.length > 500;

  const url = `https://velog.io/@${username}/${post.url_slug}`;

  return (
    <PostViewerProvider prefetchLinkedPosts={prefetchLinkedPosts}>
      <Helmet>
        <title>{post.title}</title>
        {post.short_description && (
          <meta name="description" content={post.short_description} />
        )}
        <link rel="canonical" href={url} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.short_description} />
        {post.thumbnail && (
          <meta
            property="og:image"
            content={optimizeImage(post.thumbnail, 768)}
          />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.short_description} />
        {post.thumbnail && (
          <meta name="twitter:image" content={post.thumbnail} />
        )}
      </Helmet>
      <PostHead
        title={post.title}
        tags={post.tags}
        username={username}
        date={post.released_at}
        thumbnail={
          post.thumbnail &&
          (post.body.includes(encodeURI(post.thumbnail))
            ? null
            : post.thumbnail)
        }
        series={post.series}
        hideThumbnail={!!post.thumbnail && post.body.includes(post.thumbnail)}
        postId={post.id}
        ownPost={post.user.id === userId}
        onRemove={onRemove}
        onEdit={onEdit}
        onOpenStats={onOpenStats}
        shareButtons={
          <PostLikeShareButtons
            onLikeToggle={onLikeToggle}
            onShareClick={onShareClick}
            likes={post.likes}
            liked={post.liked}
            postId={post.id}
          />
        }
        toc={<PostToc />}
        isPrivate={post.is_private}
        mobileLikeButton={
          <MobileLikeButton
            likes={post.likes}
            liked={post.liked}
            onToggle={onLikeToggle}
          />
        }
        followButton={
          <FollowButton
            followed={post.user.is_followed}
            followingUserId={post.user.id}
          />
        }
      />
      {shouldShowBanner ? <PostBanner customAd={customAd} /> : null}
      <PostContent isMarkdown={post.is_markdown} body={post.body} />
      <UserProfileWrapper>
        <UserProfile
          thumbnail={post.user.profile.thumbnail}
          displayName={post.user.profile.display_name}
          description={post.user.profile.short_bio}
          profileLinks={post.user.profile.profile_links}
          username={post.user.username}
          ownPost={post.user.id === userId}
          followButton={
            <FollowButton
              followed={post.user.is_followed}
              followingUserId={post.user.id}
            />
          }
        />
      </UserProfileWrapper>
      <LinkedPostList linkedPosts={post.linked_posts} />
      {shouldShowBanner && isContentLongEnough ? (
        <PostBanner customAd={customAd} />
      ) : null}
      {shouldShowFooterBanner ? (
        <PostBanner isDisplayAd={true} customAd={customAd} />
      ) : null}
      <PostComments
        count={post.comments_count}
        comments={post.comments}
        postId={post.id}
        ownPost={post.user.id === userId}
      />
      {showRecommends ? (
        <RelatedPost postId={post.id} showAds={post?.user.id !== userId} />
      ) : null}
    </PostViewerProvider>
  );
};

export default withRouter(PostViewer);
