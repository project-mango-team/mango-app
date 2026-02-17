const Logo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  }

  return (
    <img 
      src="/logo.svg" 
      alt="Mango" 
      className={`${sizes[size]} ${className}`}
    />
  )
}

export default Logo
