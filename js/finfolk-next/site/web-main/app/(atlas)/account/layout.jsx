import {publicAPI} from '../../../lib/public-api.js';
import AccountFrame from './frame.jsx';
export default async function AccountLayout({children}){const catalog=await publicAPI('sites/catalog');return <AccountFrame sites={catalog.beaches||[]}>{children}</AccountFrame>}
