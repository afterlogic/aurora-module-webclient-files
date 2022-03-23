const Types = require('%PathToCoreWebclientModule%/js/utils/Types.js');

const ExtendedPropsPrototype = {
	updateExtendedProps: function (data = {})
	{
		if (!this.oExtendedProps) {
			this.oExtendedProps = {};
		}
		for (const key in data) {
			this.oExtendedProps[key] = data[key];
		}
		this.parseExtendedProps();
	},

	parseExtendedProps: function ()
	{
		const
			sharedWithMeAccess = this.oExtendedProps.SharedWithMeAccess,
			shares = Types.pArray(this.oExtendedProps.Shares)
		;
		this.sharedWithMeAccessReshare(sharedWithMeAccess === Enums.SharedFileAccess.Reshare);
		this.sharedWithMeAccessWrite(this.sharedWithMeAccessReshare() || sharedWithMeAccess === Enums.SharedFileAccess.Write);
		this.sharedWithMe(this.sharedWithMeAccessWrite() || sharedWithMeAccess === Enums.SharedFileAccess.Read);
		this.sharedWithOthers(shares.length > 0);
	}
};

module.exports = ExtendedPropsPrototype;
