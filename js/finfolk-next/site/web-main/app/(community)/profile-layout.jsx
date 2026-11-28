// Shared identity layout for member profiles and organisation pages.
export function ProfileHero({portrait,children,className='',id}){return <section id={id} className={'member-hero '+className}>{portrait}<div className="profile-identity">{children}</div></section>;}
export function ProfileSection({title,children,actions,id,className=''}){return <section id={id} className={'profile-section '+className}><div className="profile-section-heading"><h2>{title}</h2>{actions}</div>{children}</section>;}
