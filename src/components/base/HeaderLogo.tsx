import * as React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Logo, VelogIcon } from '../../static/svg';
import { UserLogo } from '../../modules/header';
import palette from '../../lib/styles/palette';
import { createFallbackTitle } from '../../lib/utils';
import media from '../../lib/styles/media';

export interface HeaderLogoProps {
  custom: boolean;
  userLogo: UserLogo | null;
  velogUsername: string | null;
}

const HeaderLogo: React.FC<HeaderLogoProps> = ({
  custom,
  userLogo,
  velogUsername,
}) => {
  if (!custom) {
    return (
      <HeaderLogoBlock>
        <Link to="/">
          <Logo data-testid="velog-logo" className="velog-logo" />
        </Link>
      </HeaderLogoBlock>
    );
  }
  if (!userLogo) return null;
  if (!velogUsername) return null;
  const velogPath = `/@${velogUsername}`;
  return (
    <HeaderLogoBlock>
      <VelogLogoLink to="/">
        <VelogIcon />
      </VelogLogoLink>
      <Link to={velogPath}>
        {userLogo.title || createFallbackTitle(velogUsername)}
      </Link>
    </HeaderLogoBlock>
  );
};

const HeaderLogoBlock = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: ${palette.gray8};
  font-size: 1.3125rem;
  text-decoration: none;
  font-family: Fira Mono, monospace;

  ${media.medium} {
    font-size: 1.125rem;
    .velog-logo {
      height: 1.25rem;
    }
  }

  a {
    display: flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
  }
`;

const VelogLogoLink = styled(Link)`
  color: inherit;
  svg {
    margin-right: 1rem;
    width: 1.75rem;
    height: 1.75rem;
    display: block;
    ${media.medium} {
      width: 1.5rem;
      height: 1.5rem;
      margin-right: 0.75rem;
    }
  }
`;

export default HeaderLogo;
