const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  console.log('🌐 Navigating to demo page...')
  await page.goto('http://localhost:3003/demo')
  await page.waitForLoadState('networkidle')

  console.log('📝 Filling in the form...')
  await page.fill(
    'textarea',
    'Hello Claude! This is a real test of the Arrakis system. Can you tell me about conversation capture?'
  )

  console.log('🚀 Clicking submit button...')
  await page.click('button:has-text("Send to Claude Code")')

  console.log('⏳ Waiting for response...')
  await page.waitForTimeout(10000) // Wait 10 seconds for response

  console.log('📸 Taking screenshot of result...')
  await page.screenshot({ path: 'screenshot-form-test.png', fullPage: true })

  console.log('✅ Test completed')
  await browser.close()
})()
