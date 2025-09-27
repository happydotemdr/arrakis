const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  console.log('🌐 Navigating to demo page...')
  await page.goto('http://localhost:3003/demo')

  // Wait for page to load
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  console.log('📸 Taking screenshot...')
  await page.screenshot({
    path: 'screenshot-real-claude-demo.png',
    fullPage: true,
  })

  console.log('✅ Screenshot saved as screenshot-real-claude-demo.png')
  await browser.close()
})()
