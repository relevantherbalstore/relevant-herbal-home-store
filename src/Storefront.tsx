import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowRight, BadgeCheck, Check, CircleUserRound, Heart, Leaf, Menu, Minus, Pencil, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Truck, X } from 'lucide-react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, googleProvider, storage } from './lib/firebase'
import { starterProducts } from './data/products'
import type { Product } from './data/products'
import './store.css'
import './admin.css'

const ADMIN_EMAIL = 'relevantherbalpharma@gmail.com'
const WHATSAPP_NUMBER = '9238392977'
const DELIVERY_FEE = 250
const COPYRIGHT_YEAR = new Date().getFullYear()
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
type CartLine = { product: Product; quantity: number }

export default function Storefront() {
  const [user, setUser] = useState<User | null>(null)
  const [products, setProducts] = useState<Product[]>(starterProducts)
  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All products')
  const [cartOpen, setCartOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const isAdmin = user?.email === ADMIN_EMAIL && user.emailVerified

  useEffect(() => auth ? onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    if (nextUser?.email === ADMIN_EMAIL && nextUser.emailVerified) setAdminOpen(true)
  }) : undefined, [])
  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, 'products'), (snapshot) => {
      const liveProducts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)
      setProducts([...liveProducts, ...starterProducts.filter((seed) => !liveProducts.some((item) => item.id === seed.id || item.name === seed.name))])
    }, () => setNotice('Could not load the live catalogue. Check your Firebase setup.'))
  }, [])

  const categories = useMemo(() => ['All products', ...new Set(products.map((item) => item.category).filter(Boolean))], [products])
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesText = `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (category === 'All products' || product.category === category)
  }), [category, products, query])
  const subtotal = cart.reduce((total, line) => total + getPrice(line.product) * line.quantity, 0)
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0)

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }]
    })
    setNotice(`${product.name} added to your bag`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0))
  }

  async function handleGoogleSignIn() {
    if (!auth || !googleProvider) {
      setNotice('Google sign-in is ready once Firebase is configured in your environment.')
      return
    }
    setBusy(true)
    try {
      const isMobile = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      const result = await signInWithPopup(auth, googleProvider)
      if (result.user.email === ADMIN_EMAIL && result.user.emailVerified) {
        setAdminOpen(true)
        setNotice('Welcome, store admin.')
      } else {
        setNotice(`Signed in as ${result.user.email ?? 'Google user'}. Admin tools are limited to the authorized store account.`)
      }
    } catch {
      setNotice('Google sign-in did not complete. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!db || !isAdmin) {
      setNotice('Connect Firebase and sign in with the authorized admin Google account to publish products.')
      return
    }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const name = String(form.get('name') ?? '').trim()
    const price = Number(form.get('price'))
    const discount = Number(form.get('discount') || 0)
    const stock = Number(form.get('stock') || 0)
    const imageFileValue = form.get('imageFile')
    const imageFile = imageFileValue instanceof File && imageFileValue.size > 0 ? imageFileValue : null
    if (!name || price <= 0) return
    if (imageFile && (!imageFile.type.startsWith('image/') || imageFile.size > 5 * 1024 * 1024)) {
      setNotice('Choose an image file under 5 MB.')
      return
    }
    if (imageFile && !storage) {
      setNotice('Configure the Firebase Storage bucket before uploading product images.')
      return
    }
    setBusy(true)
    try {
      let imageUrl = String(form.get('imageUrl') ?? '').trim()
      if (imageFile && storage) {
        const safeName = imageFile.name.replace(/[^\w.-]/g, '_')
        const uploaded = await uploadBytes(ref(storage, `products/${Date.now()}-${safeName}`), imageFile, { contentType: imageFile.type })
        imageUrl = await getDownloadURL(uploaded.ref)
      }
      const productData = {
        name, price, discount: Math.min(Math.max(discount, 0), 90), stock: Math.max(stock, 0),
        category: String(form.get('category') ?? '').trim() || 'Remedies',
        description: String(form.get('description') ?? '').trim(),
        imageUrl, updatedAt: serverTimestamp(),
      }
      if (editingProduct) {
        await setDoc(doc(db, 'products', editingProduct.id), productData, { merge: true })
        setNotice('Product changes saved.')
      } else {
        await addDoc(collection(db, 'products'), { ...productData, createdAt: serverTimestamp() })
        setNotice('Product published to your catalogue.')
      }
      formElement.reset()
      setEditingProduct(null)
    } catch {
      setNotice(imageFile
        ? 'Image upload needs Firebase Storage with billing enabled. Use an image URL for now, or enable Storage first.'
        : `Could not ${editingProduct ? 'update' : 'save'} this product. Check your Firestore rules and Firebase setup.`)
    } finally {
      setBusy(false)
    }
  }

  function sendOrder() {
    if (!cart.length) return
    const lines = cart.map(({ product, quantity }) => `• ${product.name} × ${quantity} — ${currency.format(getPrice(product) * quantity)}`)
    const message = ['Hello Relevant Herbal Home Store, I would like to place this order:', '', ...lines, '',
      `Subtotal: ${currency.format(subtotal)}`, `Delivery: ${currency.format(DELIVERY_FEE)} (additional)`,
      `Total: ${currency.format(subtotal + DELIVERY_FEE)}`, '', 'Please confirm availability and delivery details.'].join('\n')
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  return <div className="store-shell">
    <div className="announcement"><Sparkles size={14} /> Thoughtful wellness, delivered to your door <span>•</span> Orders confirmed personally on WhatsApp</div>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Relevant Herbal Home Store home"><span className="brand-mark"><Leaf size={23} /></span><span className="brand-name">Relevant <b>Herbal</b><small>HOME STORE</small></span></a>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation"><a href="#collection" onClick={() => setMenuOpen(false)}>Shop all</a><a href="#our-story" onClick={() => setMenuOpen(false)}>Our approach</a><a href="#care" onClick={() => setMenuOpen(false)}>Care & guidance</a></nav>
      <div className="header-actions"><button className="icon-button" onClick={() => isAdmin ? setAdminOpen(true) : handleGoogleSignIn()} aria-label={isAdmin ? 'Open admin tools' : 'Admin sign in'}>{isAdmin ? <ShieldCheck size={19} /> : <CircleUserRound size={20} />}</button><button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag with ${itemCount} items`}><ShoppingBag size={18} /><span>Bag</span><b>{itemCount}</b></button><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    <main id="top">
      <section className="hero-section"><div className="hero-copy"><div className="eyebrow"><span /> A little more care, every day</div><h1>Rooted in nature.<br /><em>Made for your</em> rituals.</h1><p>Explore a considered collection of homeopathic and herbal essentials, selected with care for your everyday wellness routine.</p><div className="hero-actions"><a className="button button-dark" href="#collection">Explore the collection <ArrowRight size={17} /></a><a className="text-link" href="#our-story">Our approach <ArrowDown size={15} /></a></div><div className="hero-proof"><span className="proof-icon"><BadgeCheck size={17} /></span><span>Carefully sourced<br /><b>Thoughtfully selected</b></span><i /><span className="proof-icon"><Truck size={17} /></span><span>Simple ordering<br /><b>Personal WhatsApp support</b></span></div></div>
        <div className="hero-art" aria-label="Botanical illustration"><div className="hero-stamp"><span>GOOD<br />THINGS<br /><i>grow</i></span><Leaf size={17} /></div><div className="sun-disc" /><div className="plant plant-one"><span /><span /><span /><span /><span /><span /></div><div className="plant plant-two"><span /><span /><span /><span /></div><div className="vase"><div className="vase-neck" /><div className="vase-body"><span>R<br />H</span></div></div><div className="art-caption">GROW WELL, LIVE WELL <span>✳</span> 01 / 04</div></div><div className="hero-side-note">NATURAL CARE · CONSIDERED DAILY</div>
      </section>
      <section className="promise-row" aria-label="Store qualities"><div><Leaf size={19} /><span>Nature-led selection</span></div><div><Heart size={19} /><span>Care in every detail</span></div><div><ShieldCheck size={19} /><span>Personal order support</span></div><div><Truck size={19} /><span>Delivery arranged with you</span></div></section>
      <section className="collection-section" id="collection"><div className="section-heading"><div><div className="eyebrow">A considered collection</div><h2>Find your everyday <em>essentials.</em></h2><p>Browse our growing range. Need a little help? Message us with your questions.</p></div><a href="#care" className="text-link desktop-link">Need guidance? <ArrowRight size={15} /></a></div>
        <div className="catalog-toolbar"><div className="category-tabs" role="tablist" aria-label="Filter by category">{categories.map((item) => <button key={item} className={category === item ? 'category-tab active' : 'category-tab'} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search essentials" aria-label="Search products" /></label></div>
        {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} quantity={cart.find((line) => line.product.id === product.id)?.quantity ?? 0} onAdd={() => addToCart(product)} />)}</div> : <div className="empty-products"><Leaf size={27} /><h3>Your collection is taking root.</h3><p>Our first product range is being prepared. Please check back soon.</p></div>}
        <div className="catalog-footnote"><ShieldCheck size={15} /> Brochure prices are from March 2022 and need confirmation. Product details are not medical advice.</div>
      </section>
      <section className="story-section" id="our-story"><div className="story-visual"><div className="story-card"><span className="story-number">01</span><Leaf size={48} strokeWidth={1.1} /><span className="story-script">A slower<br />kind of care.</span></div><div className="story-orbit orbit-a" /><div className="story-orbit orbit-b" /><span className="story-side">ROOTED IN CARE · NATURALLY</span></div><div className="story-copy"><div className="eyebrow">Our approach</div><h2>Good care begins with <em>good questions.</em></h2><p>Relevant Herbal Home Store is here to make discovering and ordering homeopathic and herbal products a little simpler. We value clear product information, personal service, and thoughtful care at every step.</p><p>Our catalogue is being prepared with care. We do not make medical claims—please consult a licensed healthcare professional for diagnosis or treatment advice.</p><a className="button button-outline" href="#care">How to reach us <ArrowRight size={16} /></a></div></section>
      <section className="guidance-section" id="care"><div className="guidance-icon"><Heart size={24} /></div><div><div className="eyebrow">Here when you need us</div><h2>Questions before you order?</h2><p>Send your product questions and delivery details directly to our team. We’ll confirm your order and delivery charge before dispatch.</p></div><a className="button button-dark" href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello Relevant Herbal Home Store, I have a question about your products.')}`} target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowRight size={16} /></a></section>
    </main>
    <footer className="site-footer"><div className="footer-top"><div className="footer-brand"><span className="brand-mark"><Leaf size={22} /></span><span className="brand-name">Relevant <b>Herbal</b><small>HOME STORE</small></span><p>A little more care, every day.</p></div><div className="footer-note"><b>A note on wellness</b><p>Products are not a substitute for professional medical advice, diagnosis, or treatment. Always seek guidance from a qualified healthcare professional.</p></div><div className="footer-links"><a href="#collection">Shop collection</a><a href="#our-story">Our approach</a><a href="#care">Contact & delivery</a></div></div><div className="footer-bottom"><span>© {COPYRIGHT_YEAR} Relevant Herbal Home Store</span><span>Carefully considered. Kindly delivered.</span></div></footer>

    {cartOpen && <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}><aside className="side-panel cart-panel" aria-label="Shopping bag"><div className="panel-heading"><div><span className="eyebrow">Your selection</span><h2>Your bag <span>({itemCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X /></button></div>
      {cart.length ? <><div className="cart-lines">{cart.map(({ product, quantity }) => <div className="cart-line" key={product.id}><ProductArtwork product={product} index={0} /><div className="cart-line-info"><b>{product.name}</b><small>{currency.format(getPrice(product))} each</small><div className="quantity-control"><button onClick={() => changeQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`}><Minus size={13} /></button><span>{quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label={`Add one ${product.name}`}><Plus size={13} /></button></div></div><b className="line-total">{currency.format(getPrice(product) * quantity)}</b></div>)}</div><div className="checkout-summary"><div><span>Subtotal</span><b>{currency.format(subtotal)}</b></div><div><span>Delivery <small>additional</small></span><b>{currency.format(DELIVERY_FEE)}</b></div><div className="total-row"><span>Total</span><b>{currency.format(subtotal + DELIVERY_FEE)}</b></div><p>Delivery is added separately. We’ll confirm the address and delivery details in WhatsApp.</p><button className="button button-dark checkout-button" onClick={sendOrder}>Continue on WhatsApp <ArrowRight size={17} /></button><button className="continue-link" onClick={() => setCartOpen(false)}>Continue browsing</button></div></> : <div className="empty-cart"><ShoppingBag size={33} /><h3>Your bag is taking a breather.</h3><p>Add something from the collection and it will appear here.</p><button className="button button-dark" onClick={() => setCartOpen(false)}>Browse collection <ArrowRight size={16} /></button></div>}
    </aside></div>}

    {adminOpen && <div className="overlay admin-overlay" onMouseDown={(event) => event.target === event.currentTarget && setAdminOpen(false)}><section className="admin-panel" aria-label="Store administration"><div className="panel-heading"><div><span className="eyebrow">Store management</span><h2>Admin workspace</h2></div><button className="icon-button" onClick={() => setAdminOpen(false)} aria-label="Close admin panel"><X /></button></div>
      {isAdmin ? <><div className="admin-identity"><span><ShieldCheck size={19} /></span><div><b>{user.displayName || 'Store admin'}</b><small>{user.email} · Google verified</small></div><button className="text-link" onClick={() => auth && signOut(auth)}>Sign out</button></div><div className="admin-products"><div className="form-title"><h3>Existing products</h3><p>Select a product to update its details.</p></div>{products.map((product) => <div className="admin-product-row" key={product.id}><span>{product.name}<small>{currency.format(product.price)}</small></span><button className="text-link" type="button" onClick={() => setEditingProduct(product)}><Pencil size={13} /> Edit</button></div>)}</div><form key={editingProduct?.id ?? 'new-product'} className="product-form" onSubmit={saveProduct}><div className="form-title"><h3>{editingProduct ? 'Edit product' : 'Add a product'}</h3><p>{editingProduct ? `Updating ${editingProduct.name}.` : 'Use verified product information and an image.'}</p></div><label>Product name<input name="name" required placeholder="e.g. Product name" defaultValue={editingProduct?.name ?? ''} /></label><div className="form-row"><label>Price (INR)<input name="price" type="number" min="1" required placeholder="0" defaultValue={editingProduct?.price ?? ''} /></label><label>Discount (%)<input name="discount" type="number" min="0" max="90" defaultValue={editingProduct?.discount ?? 0} /></label></div><div className="form-row"><label>Category<input name="category" placeholder="Remedies" defaultValue={editingProduct?.category ?? ''} /></label><label>Stock quantity<input name="stock" type="number" min="0" defaultValue={editingProduct?.stock ?? 0} /></label></div><label>Description<textarea name="description" rows={3} placeholder="Clear, factual product details" defaultValue={editingProduct?.description ?? ''} /></label><label>Upload image (Firebase Storage / Blaze, max 5 MB)<input name="imageFile" type="file" accept="image/*" /></label><label>Or use image URL<input name="imageUrl" type="url" placeholder="https://…" defaultValue={editingProduct?.imageUrl ?? ''} /></label><button className="button button-dark form-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : editingProduct ? 'Save changes' : 'Publish product'} <ArrowRight size={16} /></button>{editingProduct && <button className="continue-link" type="button" onClick={() => setEditingProduct(null)}>Cancel editing</button>}</form></> : <div className="admin-login"><span className="admin-lock"><ShieldCheck size={26} /></span><h3>Admin access</h3><p>Sign in with the authorized Google account to manage the store catalogue.</p><button className="button button-dark" onClick={handleGoogleSignIn} disabled={busy}>{busy ? 'Connecting…' : 'Continue with Google'} <ArrowRight size={16} /></button><small>Only the verified {ADMIN_EMAIL} account can manage products.</small></div>}
    </section></div>}
  </div>
}

function getPrice(product: Product) { return Math.round(product.price * (1 - (product.discount || 0) / 100)) }

function ProductCard({ product, index, quantity, onAdd }: { product: Product; index: number; quantity: number; onAdd: () => void }) {
  return <article className="product-card"><div className={`product-image image-tone-${index % 4}`}><ProductArtwork product={product} index={index} />{product.discount > 0 && <span className="sale-tag">-{product.discount}%</span>}<button className="favorite-button" aria-label={`Save ${product.name}`} onClick={(event) => event.currentTarget.classList.toggle('is-saved')}><Heart size={17} /></button><button className="quick-add" onClick={onAdd}><Plus size={16} /> Add to bag</button></div><div className="product-details"><div className="product-category">{product.category || 'Wellness essentials'}</div><h3>{product.name}</h3><p>{product.description || 'Thoughtfully selected for your everyday wellness routine.'}</p><div className="product-price"><b>{currency.format(getPrice(product))}</b>{product.discount > 0 && <del>{currency.format(product.price)}</del>}<button onClick={onAdd} aria-label={`Add ${product.name} to bag${quantity > 0 ? `; ${quantity} in bag` : ''}`} style={quantity > 0 ? { width: 'auto', minWidth: 27, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 } : undefined}><Plus size={quantity > 0 ? 14 : 17} />{quantity > 0 && <span>{quantity}</span>}</button></div></div></article>
}

function ProductArtwork({ product, index }: { product: Product; index: number }) {
  return product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className={`artwork-fallback artwork-${index % 4}`}><span className="artwork-sun" /><span className="artwork-vessel"><i /></span><Leaf className="artwork-leaf" size={45} strokeWidth={1.1} /><span className="artwork-label">RELEVANT<br />HERBAL</span></div>
}