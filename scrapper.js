const puppeteer = require('puppeteer');
const XLSX = require("xlsx");

(async () => {

	let browser = await puppeteer.launch({
		//args: ['--no-sandbox', '--disable-setuid-sandbox'],
		headless: true
	})
	const page = await browser.newPage();

	await page.setDefaultNavigationTimeout(60000)

    const url = 'https://newweb.nepalstock.com/floor-sheet';

    await page.goto(url);

   	let reqHeaders;
	let payloadValue;

	const logRequest = async (req) => {
		if (req.url() == "https://newweb.nepalstock.com/api/nots/nepse-data/floorsheet?&sort=contractId,desc") {
			reqHeaders = await req.headers();
			let value = { 'content-type': 'application/json',}
			reqHeaders = { ...reqHeaders, ...value};
			payloadValue = req.postData();
			// console.log(reqHeaders);	
            console.log('Headers Done')
            offRequest();
		}
	}

	page.on('request', logRequest)

    const offRequest = () => { page.off('request', logRequest)};

	await page.waitForResponse((response) => {
		return response.url() == "https://newweb.nepalstock.com/api/nots/nepse-data/market-open";
	});

	await page.waitForResponse((response) => {
		return response.url() == "https://newweb.nepalstock.com/api/nots/nepse-data/floorsheet?&sort=contractId,desc";
	});


	let x = 0;

	let fetchURL = `https://newweb.nepalstock.com/api/nots/nepse-data/floorsheet?page=${x}&size=500&sort=contractId,desc`;

	let isFirst = true;

	let floorsheetContent = [];

	const logger = async (data) => { 
		let content = data["floorsheets"]["content"];
		let filterContent = [];
		for(a in content){
			filterContent.push(content[a])
		}
		floorsheetContent = [ ...floorsheetContent, ...content]

		let totalPages = data["floorsheets"]["totalPages"];

		if( x <= totalPages ){
			console.log(x + 1, totalPages)
			x = x + 1;
			fetchURL = `https://newweb.nepalstock.com/api/nots/nepse-data/floorsheet?page=${x}&size=500&sort=contractId,desc`;
			fetchFunc()
		} else if ( x > totalPages) {
			createExcelFile();
			await browser.close();
		}
		}
		
	await page.exposeFunction('logger', logger);

	//this authGen function is used to get the latest new authorization token
	const authGen = async () => {
		const offRequest2 = () => { 
			page.off('request', authLestener)
			fetchFunc()
		};

		const authLestener = async (req) => {
			if (req.url().endsWith("&sort=contractId,desc")) {
				reqHeaders = await req.headers();
				let value = { 'content-type': 'application/json',}
				reqHeaders = { ...reqHeaders, ...value};
				// console.log(reqHeaders);	
				console.log('Auth regenerated')
				offRequest2();
			}
		}
	
		page.on('request', authLestener);

		let nextBtn = await page.waitForXPath("/html/body/app-root/div/main/div/app-floor-sheet/div/div[5]/div[2]/pagination-controls/pagination-template/ul/li[10]/a");
		await nextBtn.click();
	}

	await page.exposeFunction('authGen', authGen);

		const createExcelFile = () => {
			console.log("Creating excel file");
			// console.log(floorsheetContent)
			const workSheet = XLSX.utils.json_to_sheet(floorsheetContent);
			const workBook = XLSX.utils.book_new();
		
			XLSX.utils.book_append_sheet(workBook, workSheet, "floorsheetContent")
			// Generate buffer
			XLSX.write(workBook, { bookType: 'xlsx', type: "buffer" })
		
			// Binary string
			XLSX.write(workBook, { bookType: "xlsx", type: "binary" })
		
			XLSX.writeFile(workBook, "floorsheetContent.xlsx")
			console.log("File Created")
		}

		//this function is to console log the error message
		const errorLog = async (error) => {
			console.log('Error Log: ', JSON.stringify(error));
			fetchFunc();
		}

		await page.exposeFunction('errorLog', errorLog);

		const fetchFunc = async () => {

			await page.evaluate((reqHeaders, fetchURL, payloadValue) => {
				fetch(fetchURL ,{
					method: "POST",
					headers: reqHeaders,
					// body: JSON.stringify({id: 433}),
					body: payloadValue,
					})
					.then(res => {
						if (res.status !== 200) {
							console.log("Response status is not 200")
							authGen();
						} else if ( !res.ok ){
							throw Error(res.statusText);
						}
						return res.json();
					})
					.then( data => { logger(data)})
					.catch((error) => {
						errorLog(error)
					})
	
			}, reqHeaders, fetchURL, payloadValue)
		}

	fetchFunc();


})()