import fetch from 'isomorphic-fetch'
import fs from 'fs-extra-promise'
import ProxyAgent from 'https-proxy-agent'
import path from 'path'

export default
class Picture {
	constructor({src, name, width, height}) {
		Object.assign(this, {
			_src: src,
			_name: name,
			_width: width,
			_height: height
		})
	}
	get(prop) {
		return this[`_${prop}`]
	}
	toJS() {
		const json = {}
		Object.keys(this).forEach(key => {
			json[key.replace(/^_/, '')] = this[key]
		})
		return json
	}
	/**
	 * 下载
	 * @param {Object} option {
	 *   headers: { referer, cookie },
	 *   proxy,
	 *   path
	 * }
	 */
	async downloadAsync(option) {
		let res
		//请求图片资源
		try {
			res = await fetch(this._src, {
				headers: new Headers({
					...option.headers
				}),
				agent: option.proxy && new ProxyAgent(option.proxy)
			})
		} catch (err) {
			throw new Error(`err -> requestAsync Picture :${this._name}\n${err}`)
		}

		//当返回状态为404
		if (res && res.status == 404) {
			this.onNotFound(option)
			throw new Error(`404:${this._src}`)
		}

		//创建下载文件夹
		try {
			await fs.mkdirsAsync(option.path)
		} catch (err) {
			throw new Error(`文件夹创建失败-${err}`)
		}

		return new Promise((resolve) => {
			//创建读取流、写入流、内容总大小，当前大小
			const rs = res.body
			const ws = fs.createWriteStream(path.join(option.path, this._name))
			const maxlen = res.headers.get('Content-Length')
			let currentlen = 0

			//读取流挂载下载、错误监听事件
			rs
				.on('data', (chunk) => {
					currentlen += chunk.length
					this.onProgress((currentlen / maxlen).toFixed(2))
				})
				.on('error', (err) => {
					this.onError(`网络连接异常-${err}`)
				})

			//写入流挂载完成、错误监听事件
			ws
				.on('finish', () => {
					this.onFinished()
					resolve()
				})
				.on('error', (err) => {
					this.onError(`图片写入异常-${err}`)
				})

			//管道连接
			rs.pipe(ws)
		})
	}
	/**
	 * 下载进度
	 * @param  {String} per '0.1'
	 */
	onProgress(per) {
		process.stdout.clearLine(1)
		process.stdout.cursorTo(0)
		process.stdout.write(`${this._name} -- 下载进度 -- ${per}`)
	}
	onFinished() {}
	onNotFound(option) {
		if (this._src.match(/\.jpg$/)) {
			this._src = this._src.replace(/\.jpg$/, '.png')
			this._name = this._name.replace(/\.jpg$/, '.png')
			this.downloadAsync(option)
		} else {
			this.onError(`${this._name}图片类型不为(jpg|png)，请求失败`)
		}
	}
	onError(err) {
		console.error(err)
	}
}
